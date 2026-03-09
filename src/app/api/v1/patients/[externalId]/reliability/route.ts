// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ externalId: string }> },
) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 },
      );
    }

    const { externalId } = await params;
    const supabase = await createServiceClient();

    // Look up patient by external_id
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id")
      .eq("tenant_id", auth.tenantId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (patientError) {
      console.error("v1 reliability: patient lookup error:", patientError);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to look up patient" } },
        { status: 500 },
      );
    }

    if (!patient) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Patient not found with given external_id" } },
        { status: 404 },
      );
    }

    // Count appointments by terminal status
    const { data: appointments, error: apptError } = await supabase
      .from("appointments")
      .select("status, scheduled_at")
      .eq("tenant_id", auth.tenantId)
      .eq("patient_id", patient.id)
      .in("status", ["completed", "no_show", "cancelled"]);

    if (apptError) {
      console.error("v1 reliability: appointments query error:", apptError);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to fetch appointments" } },
        { status: 500 },
      );
    }

    const rows = appointments ?? [];
    const completed = rows.filter((a) => a.status === "completed").length;
    const noShows = rows.filter((a) => a.status === "no_show").length;
    const cancellations = rows.filter((a) => a.status === "cancelled").length;
    const total = rows.length;

    const reliabilityScore = total > 0
      ? Math.round((completed / total) * 100 * 100) / 100
      : 0;

    // Find most recent visit
    const completedRows = rows
      .filter((a) => a.status === "completed")
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

    const lastVisit = completedRows.length > 0 ? completedRows[0].scheduled_at : null;

    return NextResponse.json({
      success: true,
      data: {
        reliability_score: reliabilityScore,
        total_appointments: total,
        completed,
        no_shows: noShows,
        cancellations,
        last_visit: lastVisit,
      },
    });
  } catch (err) {
    console.error("v1 reliability GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}
