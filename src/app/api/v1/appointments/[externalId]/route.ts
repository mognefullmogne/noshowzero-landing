// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";

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
      .select("id, external_id, status, risk_score, risk_reasoning, scheduled_at, duration_min, service_name, provider_name, confirmed_at, declined_at, created_at")
      .eq("tenant_id", auth.tenantId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    // Get reminders for this appointment
    const { data: reminders } = await supabase
      .from("reminders")
      .select("id, channel, message_tone, scheduled_at, sent_at, status")
      .eq("appointment_id", data.id)
      .order("scheduled_at", { ascending: true });

    return NextResponse.json({
      success: true,
      data: { ...data, reminders: reminders ?? [] },
    });
  } catch (err) {
    console.error("v1 appointment GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
