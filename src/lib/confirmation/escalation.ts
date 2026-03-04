/**
 * Multi-touch confirmation escalation logic.
 *
 * Processes workflows through the 3-touch escalation ladder:
 *   Touch 1: WhatsApp confirmation — already sent (state = message_sent)
 *   Touch 2: SMS reminder — 24h before appointment (message_sent -> reminder_sent)
 *   Touch 3: Final warning — 6h before appointment (reminder_sent -> final_warning_sent)
 *   Timeout: 2h after Touch 3 with no response -> timed_out -> triggers cascade
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessageChannel } from "@/lib/types";
import { sendMessage } from "@/lib/messaging/send-message";
import {
  markReminderSent,
  markFinalWarningSent,
  markTimedOut,
  ESCALATION_TOUCH_2_HOURS_BEFORE,
  ESCALATION_TOUCH_3_HOURS_BEFORE,
} from "./workflow";
import {
  renderReminderSms,
  renderReminderWhatsApp,
  renderFinalWarningSms,
  renderFinalWarningWhatsApp,
} from "./templates";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";

interface EscalationResult {
  readonly touch2Sent: number;
  readonly touch3Sent: number;
  readonly timedOut: number;
  readonly backfilled: number;
  readonly errors: number;
}

/** Shape of workflow row joined with appointment + patient. */
interface WorkflowRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly appointment_id: string;
  readonly state: string;
  readonly deadline_at: string;
  readonly appointment: {
    readonly id: string;
    readonly scheduled_at: string;
    readonly service_name: string;
    readonly provider_name: string | null;
    readonly location_name: string | null;
    readonly patient: {
      readonly id: string;
      readonly first_name: string;
      readonly last_name: string;
      readonly phone: string | null;
      readonly preferred_channel: string;
    } | null;
  } | null;
}

/**
 * Run the full escalation cycle for all active confirmation workflows.
 * Called by the escalate-confirmations cron job.
 */
export async function runEscalation(supabase: SupabaseClient): Promise<EscalationResult> {
  const result: EscalationResult = {
    touch2Sent: 0,
    touch3Sent: 0,
    timedOut: 0,
    backfilled: 0,
    errors: 0,
  };

  const touch2Result = await escalateToTouch2(supabase);
  const touch3Result = await escalateToTouch3(supabase);
  const timeoutResult = await escalateToTimeout(supabase);

  return {
    touch2Sent: touch2Result.sent,
    touch3Sent: touch3Result.sent,
    timedOut: timeoutResult.timedOut,
    backfilled: timeoutResult.backfilled,
    errors: touch2Result.errors + touch3Result.errors + timeoutResult.errors,
  };
}

/**
 * Touch 2: Find message_sent workflows where the appointment is within 24h.
 * Send SMS reminder and transition to reminder_sent.
 */
async function escalateToTouch2(
  supabase: SupabaseClient
): Promise<{ sent: number; errors: number }> {
  const now = new Date();
  const touch2Cutoff = new Date(now.getTime() + ESCALATION_TOUCH_2_HOURS_BEFORE * 60 * 60 * 1000);

  // Find workflows in message_sent state where appointment is within 24h
  const { data: workflows, error } = await supabase
    .from("confirmation_workflows")
    .select(`
      id, tenant_id, appointment_id, state, deadline_at,
      appointment:appointments(
        id, scheduled_at, service_name, provider_name, location_name,
        patient:patients(id, first_name, last_name, phone, preferred_channel)
      )
    `)
    .eq("state", "message_sent")
    .limit(50);

  if (error || !workflows) {
    if (error) console.error("[Escalation] Touch 2 query error:", error);
    return { sent: 0, errors: error ? 1 : 0 };
  }

  let sent = 0;
  let errors = 0;

  for (const wf of workflows as unknown as WorkflowRow[]) {
    try {
      const appt = wf.appointment;
      if (!appt?.patient?.phone) continue;

      const scheduledAt = new Date(appt.scheduled_at);

      // Only escalate if appointment is within 24h from now
      if (scheduledAt > touch2Cutoff) continue;

      // Don't escalate if appointment is already past
      if (scheduledAt <= now) continue;

      const vars = buildTemplateVars(appt, appt.patient);

      // Touch 2 uses SMS regardless of preferred channel for channel diversity
      const body = renderReminderSms(vars);

      const sendResult = await sendMessage(supabase, {
        tenantId: wf.tenant_id,
        patientId: appt.patient.id,
        patientPhone: appt.patient.phone,
        channel: "sms" as MessageChannel,
        body,
        contextAppointmentId: wf.appointment_id,
      });

      if (sendResult.success) {
        const transitioned = await markReminderSent(supabase, wf.id, scheduledAt);
        if (transitioned) {
          sent++;
          console.info(`[Escalation] Touch 2 (SMS reminder) sent for workflow ${wf.id}`);
        }
      } else {
        errors++;
        console.error(`[Escalation] Touch 2 send failed for workflow ${wf.id}:`, sendResult.error);
      }
    } catch (err) {
      errors++;
      console.error(`[Escalation] Touch 2 error for workflow ${wf.id}:`, err);
    }
  }

  return { sent, errors };
}

/**
 * Touch 3: Find reminder_sent workflows where the appointment is within 6h.
 * Send final warning and transition to final_warning_sent.
 */
async function escalateToTouch3(
  supabase: SupabaseClient
): Promise<{ sent: number; errors: number }> {
  const now = new Date();
  const touch3Cutoff = new Date(now.getTime() + ESCALATION_TOUCH_3_HOURS_BEFORE * 60 * 60 * 1000);

  const { data: workflows, error } = await supabase
    .from("confirmation_workflows")
    .select(`
      id, tenant_id, appointment_id, state, deadline_at,
      appointment:appointments(
        id, scheduled_at, service_name, provider_name, location_name,
        patient:patients(id, first_name, last_name, phone, preferred_channel)
      )
    `)
    .eq("state", "reminder_sent")
    .limit(50);

  if (error || !workflows) {
    if (error) console.error("[Escalation] Touch 3 query error:", error);
    return { sent: 0, errors: error ? 1 : 0 };
  }

  let sent = 0;
  let errors = 0;

  for (const wf of workflows as unknown as WorkflowRow[]) {
    try {
      const appt = wf.appointment;
      if (!appt?.patient?.phone) continue;

      const scheduledAt = new Date(appt.scheduled_at);

      // Only escalate if appointment is within 6h from now
      if (scheduledAt > touch3Cutoff) continue;

      // Don't escalate if appointment is already past
      if (scheduledAt <= now) continue;

      const vars = buildTemplateVars(appt, appt.patient);
      const channel = (appt.patient.preferred_channel as MessageChannel) ?? "whatsapp";

      // Touch 3 uses patient's preferred channel with urgent messaging
      const body = channel === "whatsapp"
        ? renderFinalWarningWhatsApp(vars)
        : renderFinalWarningSms(vars);

      const sendResult = await sendMessage(supabase, {
        tenantId: wf.tenant_id,
        patientId: appt.patient.id,
        patientPhone: appt.patient.phone,
        channel,
        body,
        contextAppointmentId: wf.appointment_id,
      });

      if (sendResult.success) {
        const transitioned = await markFinalWarningSent(supabase, wf.id);
        if (transitioned) {
          sent++;
          console.info(`[Escalation] Touch 3 (final warning) sent for workflow ${wf.id}`);
        }
      } else {
        errors++;
        console.error(`[Escalation] Touch 3 send failed for workflow ${wf.id}:`, sendResult.error);
      }
    } catch (err) {
      errors++;
      console.error(`[Escalation] Touch 3 error for workflow ${wf.id}:`, err);
    }
  }

  return { sent, errors };
}

/**
 * Timeout: Find final_warning_sent workflows past their deadline (2h after Touch 3).
 * Mark as timed_out and trigger cascade backfill.
 */
async function escalateToTimeout(
  supabase: SupabaseClient
): Promise<{ timedOut: number; backfilled: number; errors: number }> {
  const now = new Date().toISOString();

  const { data: workflows, error } = await supabase
    .from("confirmation_workflows")
    .select("id, tenant_id, appointment_id")
    .eq("state", "final_warning_sent")
    .lte("deadline_at", now)
    .limit(50);

  if (error || !workflows) {
    if (error) console.error("[Escalation] Timeout query error:", error);
    return { timedOut: 0, backfilled: 0, errors: error ? 1 : 0 };
  }

  let timedOut = 0;
  let backfilled = 0;
  let errors = 0;

  for (const wf of workflows) {
    try {
      const success = await markTimedOut(supabase, wf.id);
      if (!success) continue;

      timedOut++;

      // Update appointment status to timeout
      await supabase
        .from("appointments")
        .update({ status: "timeout" })
        .eq("id", wf.appointment_id)
        .eq("tenant_id", wf.tenant_id)
        .in("status", ["scheduled", "reminder_sent", "reminder_pending"]);

      // Trigger cascade backfill
      const offerId = await triggerBackfill(supabase, wf.appointment_id, wf.tenant_id);
      if (offerId) {
        backfilled++;
        console.info(`[Escalation] Cascade triggered for timed-out workflow ${wf.id}`);
      }
    } catch (err) {
      errors++;
      console.error(`[Escalation] Timeout error for workflow ${wf.id}:`, err);
    }
  }

  return { timedOut, backfilled, errors };
}

/** Helper to build template vars from appointment + patient data. */
function buildTemplateVars(
  appt: NonNullable<WorkflowRow["appointment"]>,
  patient: NonNullable<NonNullable<WorkflowRow["appointment"]>["patient"]>
): {
  patientName: string;
  serviceName: string;
  date: string;
  time: string;
  providerName?: string;
  locationName?: string;
} {
  const scheduledAt = new Date(appt.scheduled_at);
  return {
    patientName: `${patient.first_name} ${patient.last_name}`,
    serviceName: appt.service_name,
    date: scheduledAt.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    time: scheduledAt.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    providerName: appt.provider_name ?? undefined,
    locationName: appt.location_name ?? undefined,
  };
}
