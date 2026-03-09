// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { computeAiRiskScore } from "@/lib/scoring/ai-risk-score";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ externalId: string }> }
) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    const { externalId } = await params;
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("appointments")
      .select("id, risk_score, risk_reasoning, risk_scored_at")
      .eq("tenant_id", auth.tenantId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        score: data.risk_score,
        reasoning: data.risk_reasoning,
        scored_at: data.risk_scored_at,
      },
    });
  } catch (err) {
    console.error("v1 appointment risk GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ externalId: string }> }
) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    const { externalId } = await params;
    const supabase = await createServiceClient();

    const { data: appointment, error: lookupErr } = await supabase
      .from("appointments")
      .select("id, patient_id, risk_score, scheduled_at, created_at, service_code")
      .eq("tenant_id", auth.tenantId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (lookupErr || !appointment) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    // Gather patient history for AI risk scoring
    const [totalResult, noShowResult, cancelResult, confirmResult] = await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", appointment.patient_id)
        .eq("tenant_id", auth.tenantId),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", appointment.patient_id)
        .eq("tenant_id", auth.tenantId)
        .eq("status", "no_show"),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", appointment.patient_id)
        .eq("tenant_id", auth.tenantId)
        .eq("status", "cancelled"),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", appointment.patient_id)
        .eq("tenant_id", auth.tenantId)
        .eq("status", "confirmed"),
    ]);

    const previousScore = appointment.risk_score;

    const result = await computeAiRiskScore({
      totalAppointments: totalResult.count ?? 0,
      noShows: noShowResult.count ?? 0,
      cancellations: cancelResult.count ?? 0,
      confirmations: confirmResult.count ?? 0,
      scheduledAt: new Date(appointment.scheduled_at),
      createdAt: new Date(appointment.created_at),
      serviceCode: appointment.service_code ?? undefined,
    });

    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("appointments")
      .update({
        risk_score: result.score,
        risk_reasoning: result.reasoning,
        risk_scored_at: now,
      })
      .eq("id", appointment.id)
      .eq("tenant_id", auth.tenantId);

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to update risk score" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        score: result.score,
        reasoning: result.reasoning,
        ai_generated: result.aiGenerated,
        previous_score: previousScore,
      },
    });
  } catch (err) {
    console.error("v1 appointment risk POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
