// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { PublicUpdateAppointmentSchema } from "@/lib/validations";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";
import { dispatchWebhookEvent } from "@/lib/webhooks/outbound";

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

export async function PATCH(
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
    const body = await request.json();
    const parsed = PublicUpdateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Look up existing appointment
    const { data: existing, error: lookupErr } = await supabase
      .from("appointments")
      .select("id, status, scheduled_at, duration_min, notes")
      .eq("tenant_id", auth.tenantId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (lookupErr || !existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    const { status, cancellation_reason, scheduled_at, duration_min, notes } = parsed.data;

    // Build update payload (immutable — new object, no mutation)
    const updateFields: Record<string, unknown> = {};
    if (status !== undefined) updateFields.status = status;
    if (cancellation_reason !== undefined) updateFields.cancellation_reason = cancellation_reason;
    if (scheduled_at !== undefined) updateFields.scheduled_at = scheduled_at;
    if (duration_min !== undefined) updateFields.duration_min = duration_min;
    if (notes !== undefined) updateFields.notes = notes;

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "No fields to update" } },
        { status: 400 }
      );
    }

    const { data: updated, error: updateErr } = await supabase
      .from("appointments")
      .update(updateFields)
      .eq("id", existing.id)
      .eq("tenant_id", auth.tenantId)
      .select("id, external_id, status, risk_score, risk_reasoning, scheduled_at, duration_min, service_name, provider_name, confirmed_at, declined_at, created_at")
      .single();

    if (updateErr || !updated) {
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to update appointment" } },
        { status: 500 }
      );
    }

    // Audit log for status changes
    if (status !== undefined && status !== existing.status) {
      await supabase.from("audit_events").insert({
        tenant_id: auth.tenantId,
        entity_type: "appointment",
        entity_id: existing.id,
        action: "status_changed",
        details: {
          old_status: existing.status,
          new_status: status,
          source: "api_v1",
        },
      });
    }

    // Trigger backfill cascade on cancellation
    if (status === "cancelled" && existing.status !== "cancelled") {
      await triggerBackfill(supabase, existing.id, auth.tenantId);
    }

    // Dispatch webhook events for status changes
    if (status && status !== existing.status) {
      const webhookEventMap: Record<string, string> = {
        cancelled: "appointment.cancelled",
        completed: "appointment.completed",
        no_show: "appointment.no_show",
      };
      const webhookEvent = webhookEventMap[status];
      if (webhookEvent) {
        try { await dispatchWebhookEvent(auth.tenantId, webhookEvent, updated); } catch { /* webhook delivery is best-effort */ }
      }
    }

    // Get reminders for this appointment
    const { data: reminders } = await supabase
      .from("reminders")
      .select("id, channel, message_tone, scheduled_at, sent_at, status")
      .eq("appointment_id", existing.id)
      .order("scheduled_at", { ascending: true });

    return NextResponse.json({
      success: true,
      data: { ...updated, reminders: reminders ?? [] },
    });
  } catch (err) {
    console.error("v1 appointment PATCH error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
