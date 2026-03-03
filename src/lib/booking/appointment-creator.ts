/**
 * Create an appointment from a completed booking session.
 * Reuses the same risk scoring, reminder scheduling, and confirmation
 * workflow logic as the POST /api/appointments endpoint.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeRiskScore } from "@/lib/scoring/risk-score";
import {
  generateContactSchedule,
  scheduleToReminders,
} from "@/lib/scoring/contact-timing";
import { createConfirmationWorkflow } from "@/lib/confirmation/workflow";
import type { MessageChannel } from "@/lib/types";

interface CreateBookingResult {
  readonly success: true;
  readonly appointmentId: string;
}

interface CreateBookingError {
  readonly success: false;
  readonly error: string;
}

/**
 * Create an appointment from a booking session.
 * - Computes risk score
 * - Updates slot status to booked
 * - Creates reminders
 * - Creates confirmation workflow
 */
export async function createAppointmentFromBooking(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  slot: {
    readonly slotId: string;
    readonly startAt: string;
    readonly endAt: string;
    readonly providerName: string;
  },
  serviceName: string
): Promise<CreateBookingResult | CreateBookingError> {
  try {
    // 1. Atomically claim the slot — only succeeds if still available.
    // This prevents double-booking via concurrent requests.
    const { data: claimedSlot, error: claimError } = await supabase
      .from("appointment_slots")
      .update({ status: "booked" })
      .eq("id", slot.slotId)
      .eq("tenant_id", tenantId)
      .eq("status", "available")
      .select("id")
      .maybeSingle();

    if (claimError || !claimedSlot) {
      return { success: false, error: "slot_unavailable" };
    }

    // 2. Get patient history for risk scoring
    const [{ count: totalAppts }, { count: noShows }] = await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", patientId)
        .eq("tenant_id", tenantId),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", patientId)
        .eq("tenant_id", tenantId)
        .eq("status", "no_show"),
    ]);

    const now = new Date();
    const scheduledAt = new Date(slot.startAt);
    const durationMs = new Date(slot.endAt).getTime() - scheduledAt.getTime();
    const durationMin = Math.round(durationMs / 60_000) || 30;

    // 3. Compute risk score
    const riskResult = computeRiskScore({
      totalAppointments: totalAppts ?? 0,
      noShows: noShows ?? 0,
      scheduledAt,
      createdAt: now,
    });

    // 4. Insert appointment
    const { data: appointment, error: insertError } = await supabase
      .from("appointments")
      .insert({
        tenant_id: tenantId,
        patient_id: patientId,
        service_name: serviceName,
        provider_name: slot.providerName,
        scheduled_at: slot.startAt,
        duration_min: durationMin,
        status: "scheduled",
        risk_score: riskResult.score,
        risk_reasoning: riskResult.reasoning,
        risk_scored_at: now.toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !appointment) {
      // Rollback: release the slot we claimed
      await supabase
        .from("appointment_slots")
        .update({ status: "available", appointment_id: null })
        .eq("id", slot.slotId)
        .eq("tenant_id", tenantId);
      console.error("[BookingCreator] Appointment insert error:", { code: insertError?.code, message: insertError?.message });
      return { success: false, error: "insert_failed" };
    }

    // 5. Link appointment to the slot
    const { error: slotLinkError } = await supabase
      .from("appointment_slots")
      .update({ appointment_id: appointment.id })
      .eq("id", slot.slotId)
      .eq("tenant_id", tenantId);

    if (slotLinkError) {
      console.error("[BookingCreator] Slot link error:", { code: slotLinkError.code, message: slotLinkError.message });
    }

    // 6. Get patient preferred channel for reminders
    const { data: patient } = await supabase
      .from("patients")
      .select("preferred_channel")
      .eq("id", patientId)
      .maybeSingle();

    const preferredChannel: MessageChannel =
      (patient?.preferred_channel as MessageChannel) ?? "whatsapp";

    // 7. Schedule reminders
    const schedule = generateContactSchedule(riskResult.score, preferredChannel);
    const reminderTimes = scheduleToReminders(scheduledAt, schedule);

    if (reminderTimes.length > 0) {
      const reminderRows = reminderTimes.map((r) => ({
        tenant_id: tenantId,
        appointment_id: appointment.id,
        channel: r.channel,
        message_tone: r.messageTone,
        scheduled_at: r.scheduledAt.toISOString(),
        status: "pending",
      }));

      const { error: reminderError } = await supabase
        .from("reminders")
        .insert(reminderRows);

      if (reminderError) {
        console.error("[BookingCreator] Reminder insert error:", reminderError);
      }
    }

    // 8. Create confirmation workflow (non-blocking)
    createConfirmationWorkflow(supabase, tenantId, appointment.id, scheduledAt)
      .catch((err) => console.error("[BookingCreator] Workflow error:", err));

    return { success: true, appointmentId: appointment.id };
  } catch (err) {
    console.error("[BookingCreator] Unexpected error:", err);
    return { success: false, error: "unexpected_error" };
  }
}
