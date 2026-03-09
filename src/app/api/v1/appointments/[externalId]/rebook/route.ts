// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { findCalendarGaps, generateRebookingSuggestions } from "@/lib/ai/smart-rebook";

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

    const { data: appointment, error: lookupErr } = await supabase
      .from("appointments")
      .select("id, patient_id, status, service_name, provider_name, location_name, scheduled_at, duration_min")
      .eq("tenant_id", auth.tenantId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (lookupErr || !appointment) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    if (appointment.status !== "cancelled") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_STATUS", message: "Rebooking suggestions are only available for cancelled appointments" } },
        { status: 400 }
      );
    }

    const [gaps, suggestions] = await Promise.all([
      findCalendarGaps(supabase, auth.tenantId, appointment.duration_min, {
        excludeSlotAt: appointment.scheduled_at,
      }),
      generateRebookingSuggestions(supabase, auth.tenantId, appointment.patient_id, {
        id: appointment.id,
        service_name: appointment.service_name,
        provider_name: appointment.provider_name,
        location_name: appointment.location_name,
        scheduled_at: appointment.scheduled_at,
        duration_min: appointment.duration_min,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        available_slots: gaps,
        suggested_slots: suggestions.suggestedSlots,
        message: suggestions.message,
      },
    });
  } catch (err) {
    console.error("v1 appointment rebook GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
