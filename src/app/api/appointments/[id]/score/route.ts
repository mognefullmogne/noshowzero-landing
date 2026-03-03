import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { computeAiRiskScore } from "@/lib/scoring/ai-risk-score";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const supabase = await createClient();

    const { data: appointment } = await supabase
      .from("appointments")
      .select("id, patient_id, scheduled_at, service_code, created_at")
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .maybeSingle();

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    // Gather patient stats
    const { count: totalAppts } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", appointment.patient_id)
      .eq("tenant_id", auth.data.tenantId);

    const { count: noShows } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", appointment.patient_id)
      .eq("tenant_id", auth.data.tenantId)
      .eq("status", "no_show");

    const { count: cancellations } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", appointment.patient_id)
      .eq("tenant_id", auth.data.tenantId)
      .eq("status", "cancelled");

    const { count: confirmations } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", appointment.patient_id)
      .eq("tenant_id", auth.data.tenantId)
      .eq("status", "confirmed");

    const result = await computeAiRiskScore({
      totalAppointments: totalAppts ?? 0,
      noShows: noShows ?? 0,
      cancellations: cancellations ?? 0,
      confirmations: confirmations ?? 0,
      scheduledAt: new Date(appointment.scheduled_at),
      createdAt: new Date(appointment.created_at),
      serviceCode: appointment.service_code ?? undefined,
    });

    // Update appointment with new score
    const { data: updated, error: updateError } = await supabase
      .from("appointments")
      .update({
        risk_score: result.score,
        risk_reasoning: result.reasoning,
        risk_scored_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .select("id, risk_score, risk_reasoning, risk_scored_at")
      .single();

    if (updateError || !updated) {
      console.error("Score update error:", updateError);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to persist risk score" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...updated, ai_generated: result.aiGenerated },
    });
  } catch (err) {
    console.error("AI score error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
