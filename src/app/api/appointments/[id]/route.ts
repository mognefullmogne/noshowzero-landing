// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { UpdateAppointmentSchema } from "@/lib/validations";
import { VALID_TRANSITIONS, type AppointmentStatus } from "@/lib/types";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";
import { maybeProcessPending } from "@/lib/engine/process-pending";
import { generateRebookingSuggestions } from "@/lib/ai/smart-rebook";
import { sendNotification } from "@/lib/twilio/send-notification";
import { logAuditEvent } from "@/lib/audit/log-event";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid appointment ID" } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const [appointmentRes, offersRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, patient:patients(*), reminders(*)")
        .eq("id", id)
        .eq("tenant_id", auth.data.tenantId)
        .maybeSingle(),
      supabase
        .from("waitlist_offers")
        .select("id, status, smart_score, offered_at, responded_at, patient:patients(first_name, last_name)")
        .eq("original_appointment_id", id)
        .eq("tenant_id", auth.data.tenantId)
        .order("offered_at", { ascending: false }),
    ]);

    if (appointmentRes.error || !appointmentRes.data) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    const data = {
      ...appointmentRes.data,
      offers: offersRes.data ?? [],
    };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Appointment GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid appointment ID" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = UpdateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch current appointment
    const { data: current } = await supabase
      .from("appointments")
      .select("status")
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .maybeSingle();

    if (!current) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    // Validate status transition
    const currentStatus = current.status as AppointmentStatus;
    const newStatus = parsed.data.status;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowed.join(", ") || "none (terminal state)"}`,
          },
        },
        { status: 422 }
      );
    }

    // Build update data with timestamp fields
    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "confirmed") updateData.confirmed_at = new Date().toISOString();
    if (newStatus === "declined") updateData.declined_at = new Date().toISOString();
    if (newStatus === "reminder_sent") updateData.confirmation_sent_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .select("*, patient:patients(*)")
      .single();

    if (error) {
      console.error("Appointment PATCH error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to update appointment" } },
        { status: 500 }
      );
    }

    logAuditEvent({
      tenantId: auth.data.tenantId,
      actorType: "user",
      actorId: auth.data.userId,
      entityType: "appointment",
      entityId: id,
      action: "appointment.status_changed",
      metadata: { from: currentStatus, to: newStatus },
    });

    // Trigger backfill + smart rebook on cancellation/no-show.
    // MUST be awaited — on Vercel serverless, fire-and-forget promises get killed
    // when the response is returned.
    if (newStatus === "cancelled" || newStatus === "no_show") {
      try {
        const serviceClient = await createServiceClient();
        await triggerBackfill(serviceClient, id, auth.data.tenantId);
      } catch (err) {
        console.error("[Backfill] Trigger failed:", err);
      }
    }

    if (newStatus === "cancelled" && updated.patient?.phone) {
      try {
        const serviceClient = await createServiceClient();
        const suggestions = await generateRebookingSuggestions(serviceClient, auth.data.tenantId, updated.patient_id, {
          id: updated.id,
          service_name: updated.service_name,
          provider_name: updated.provider_name ?? null,
          location_name: updated.location_name ?? null,
          scheduled_at: updated.scheduled_at,
          duration_min: updated.duration_min,
        });
        await sendNotification({ to: updated.patient.phone, body: suggestions.message, channel: "whatsapp", tenantId: auth.data.tenantId });
      } catch (err) {
        console.error("[SmartRebook] Trigger failed:", err);
      }
    }

    // After any appointment status change, run the full engine to catch any cascading work.
    maybeProcessPending(supabase, auth.data.tenantId);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("Appointment PATCH error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// DELETE removed — all removals go through PATCH → status: "cancelled"
// which triggers backfill correctly without race conditions.
// The old DELETE had a race: triggerBackfill fire-and-forget, then row deleted
// before backfill could read the appointment data.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "DELETE is disabled. Use PATCH with { status: 'cancelled' } instead.",
      },
    },
    { status: 405 }
  );
}
