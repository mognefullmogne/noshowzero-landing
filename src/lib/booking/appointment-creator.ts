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
import { createConfirmationWorkflow, markMessageSent } from "@/lib/confirmation/workflow";
import { calculateConfirmationDeadline } from "@/lib/confirmation/timing";
import { sendMessage } from "@/lib/messaging/send-message";
import { renderConfirmationWhatsApp, renderConfirmationSms } from "@/lib/confirmation/templates";
import type { MessageChannel } from "@/lib/types";
import { checkProviderConflict } from "./provider-conflict";

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

    // 2. Prevent double-booking: ensure provider has no overlapping appointment
    const durationMs = new Date(slot.endAt).getTime() - new Date(slot.startAt).getTime();
    const durationMinCheck = Math.round(durationMs / 60_000) || 30;

    const conflict = await checkProviderConflict(supabase, {
      tenantId,
      providerName: slot.providerName,
      scheduledAt: slot.startAt,
      durationMin: durationMinCheck,
    });

    if (conflict.hasConflict) {
      // Release the slot we just claimed
      await supabase
        .from("appointment_slots")
        .update({ status: "available", appointment_id: null })
        .eq("id", slot.slotId)
        .eq("tenant_id", tenantId);
      return { success: false, error: "provider_conflict" };
    }

    // 3. Get patient history for risk scoring
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
    const durationMin = durationMinCheck;

    // 4. Compute risk score
    const riskResult = computeRiskScore({
      totalAppointments: totalAppts ?? 0,
      noShows: noShows ?? 0,
      scheduledAt,
      createdAt: now,
    });

    // 5. Insert appointment
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

    // 6. Link appointment to the slot
    const { error: slotLinkError } = await supabase
      .from("appointment_slots")
      .update({ appointment_id: appointment.id })
      .eq("id", slot.slotId)
      .eq("tenant_id", tenantId);

    if (slotLinkError) {
      console.error("[BookingCreator] Slot link error:", { code: slotLinkError.code, message: slotLinkError.message });
    }

    // 7. Get patient preferred channel for reminders
    const { data: patient } = await supabase
      .from("patients")
      .select("preferred_channel")
      .eq("id", patientId)
      .maybeSingle();

    const preferredChannel: MessageChannel =
      (patient?.preferred_channel as MessageChannel) ?? "whatsapp";

    // 8. Schedule reminders
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

    // 9. Create confirmation workflow and send immediately if the window is already open.
    createAndMaybeSendConfirmation(
      supabase,
      tenantId,
      appointment.id,
      scheduledAt,
      riskResult.score,
      patientId,
      preferredChannel,
      serviceName,
      slot.providerName
    ).catch((err) => console.error("[BookingCreator] Workflow error:", err));

    return { success: true, appointmentId: appointment.id };
  } catch (err) {
    console.error("[BookingCreator] Unexpected error:", err);
    return { success: false, error: "unexpected_error" };
  }
}

// ---------------------------------------------------------------------------
// Helper: create confirmation workflow and send immediately if window is open
// ---------------------------------------------------------------------------

/**
 * Create a confirmation workflow for a booking.
 * If the send deadline is already in the past (appointment is soon), send right away
 * rather than waiting for the cron or opportunistic engine to pick it up.
 */
async function createAndMaybeSendConfirmation(
  supabase: SupabaseClient,
  tenantId: string,
  appointmentId: string,
  scheduledAt: Date,
  riskScore: number,
  patientId: string,
  preferredChannel: MessageChannel,
  serviceName: string,
  providerName: string
): Promise<void> {
  const sendDeadline = calculateConfirmationDeadline(scheduledAt, riskScore);
  const now = new Date();

  const workflowId = await createConfirmationWorkflow(
    supabase,
    tenantId,
    appointmentId,
    scheduledAt,
    riskScore
  );

  // Only send immediately when deadline is already past and workflow was created
  if (!workflowId || sendDeadline > now) return;

  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name, phone")
    .eq("id", patientId)
    .maybeSingle();

  if (!patient?.phone) return;

  const dateStr = scheduledAt.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = scheduledAt.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const vars = {
    patientName: `${patient.first_name} ${patient.last_name}`,
    serviceName,
    date: dateStr,
    time: timeStr,
    providerName,
  };

  const channel = preferredChannel;
  const body =
    channel === "whatsapp"
      ? renderConfirmationWhatsApp(vars)
      : renderConfirmationSms(vars);

  const result = await sendMessage(supabase, {
    tenantId,
    patientId: patient.id,
    patientPhone: patient.phone,
    channel,
    body,
    contextAppointmentId: appointmentId,
  });

  if (result.success && result.message) {
    await markMessageSent(supabase, workflowId, result.message.id);
    console.info(
      `[BookingCreator] Conferma inviata immediatamente per appuntamento ${appointmentId}`
    );
  } else {
    console.error(
      "[BookingCreator] Invio conferma immediata fallito:",
      appointmentId,
      result.error
    );
  }
}
