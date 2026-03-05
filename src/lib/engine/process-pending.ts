// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Opportunistic processing engine.
 * Runs all pending time-sensitive checks in a single pass.
 * Called on every dashboard/API interaction for near-real-time behavior.
 * Each check is idempotent, fast, and uses atomic DB operations.
 * The daily crons remain as safety nets.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMessage } from "@/lib/messaging/send-message";
import { markMessageSent, markReminderSent, markFinalWarningSent, markTimedOut, ESCALATION_TOUCH_2_HOURS_BEFORE, ESCALATION_TOUCH_3_HOURS_BEFORE } from "@/lib/confirmation/workflow";
import { renderConfirmationWhatsApp, renderConfirmationSms, renderReminderSms, renderFinalWarningWhatsApp, renderFinalWarningSms } from "@/lib/confirmation/templates";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";
import { checkExpiredOffers } from "@/lib/backfill/check-expired-offers";
import { detectNoShows } from "@/lib/intelligence/no-show-detector";
import type { MessageChannel } from "@/lib/types";

/** Max items to process per check per engine run — keeps each call fast. */
const BATCH_LIMIT = 10;

/** Minimum milliseconds between engine runs per tenant. */
const THROTTLE_MS = 30_000;

/** Per-tenant throttle: stores the last time the engine ran for each tenant. */
const lastRunAt = new Map<string, number>();

export interface ProcessPendingResult {
  readonly confirmationsSent: number;
  readonly escalated: number;
  readonly offersExpired: number;
  readonly noShowsDetected: number;
  readonly timedOut: number;
}

/** Shape of a workflow row joined with appointment + patient. */
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
 * Run all pending time-sensitive checks for a single tenant.
 * Each check is idempotent — safe to run multiple times.
 * Returns a summary of what was processed.
 */
export async function processPending(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProcessPendingResult> {
  const now = new Date().toISOString();

  const [confirmResult, escalateResult, expireResult, noShowResult, timeoutResult] =
    await Promise.all([
      sendDueConfirmations(supabase, tenantId, now),
      escalateConfirmations(supabase, tenantId),
      checkExpiredOffers(supabase, tenantId),
      detectNoShows(supabase, tenantId),
      checkTimeouts(supabase, tenantId, now),
    ]);

  const summary: ProcessPendingResult = {
    confirmationsSent: confirmResult.sent,
    escalated: escalateResult.touch2 + escalateResult.touch3,
    offersExpired: expireResult.expired,
    noShowsDetected: noShowResult.detected,
    timedOut: timeoutResult.timedOut,
  };

  const hasActivity =
    summary.confirmationsSent > 0 ||
    summary.escalated > 0 ||
    summary.offersExpired > 0 ||
    summary.noShowsDetected > 0 ||
    summary.timedOut > 0;

  if (hasActivity) {
    console.info(
      `[Engine] tenant=${tenantId.slice(0, 8)}... confirmations=${summary.confirmationsSent} escalated=${summary.escalated} expired=${summary.offersExpired} noShows=${summary.noShowsDetected} timedOut=${summary.timedOut}`
    );
  }

  return summary;
}

/**
 * Check the per-tenant throttle and fire-and-forget the engine if enough time has passed.
 * Callers should NOT await this — it runs in the background.
 */
export function maybeProcessPending(supabase: SupabaseClient, tenantId: string): void {
  const now = Date.now();
  const last = lastRunAt.get(tenantId) ?? 0;

  if (now - last < THROTTLE_MS) {
    return;
  }

  // Update throttle timestamp immediately to prevent concurrent runs
  lastRunAt.set(tenantId, now);

  processPending(supabase, tenantId).catch((err) => {
    console.error("[Engine] processPending failed:", err);
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Send confirmation messages to workflows in pending_send state past their deadline.
 * Replaces the send-confirmations cron as the primary driver.
 */
async function sendDueConfirmations(
  supabase: SupabaseClient,
  tenantId: string,
  now: string
): Promise<{ sent: number }> {
  const { data: workflows, error } = await supabase
    .from("confirmation_workflows")
    .select(`
      id, tenant_id, appointment_id,
      appointment:appointments(
        id, service_name, provider_name, location_name, scheduled_at,
        patient:patients(id, first_name, last_name, phone, preferred_channel)
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("state", "pending_send")
    .lte("deadline_at", now)
    .limit(BATCH_LIMIT);

  if (error || !workflows || workflows.length === 0) {
    if (error) console.error("[Engine] sendDueConfirmations query error:", error);
    return { sent: 0 };
  }

  let sent = 0;

  for (const wf of workflows as unknown as WorkflowRow[]) {
    try {
      const appt = wf.appointment;
      const patient = appt?.patient;

      if (!patient?.phone) continue;

      const scheduledAt = new Date(appt!.scheduled_at);
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
        serviceName: appt!.service_name,
        date: dateStr,
        time: timeStr,
        providerName: appt!.provider_name ?? undefined,
        locationName: appt!.location_name ?? undefined,
      };

      const channel = (patient.preferred_channel as MessageChannel) ?? "whatsapp";
      const body =
        channel === "whatsapp"
          ? renderConfirmationWhatsApp(vars)
          : renderConfirmationSms(vars);

      const result = await sendMessage(supabase, {
        tenantId: wf.tenant_id,
        patientId: patient.id,
        patientPhone: patient.phone,
        channel,
        body,
        contextAppointmentId: wf.appointment_id,
      });

      if (result.success && result.message) {
        const ok = await markMessageSent(supabase, wf.id, result.message.id);
        if (ok) sent++;
      } else {
        console.error("[Engine] Confirmation send failed for workflow:", wf.id, result.error);
      }
    } catch (err) {
      console.error("[Engine] sendDueConfirmations error for workflow:", wf.id, err);
    }
  }

  return { sent };
}

/**
 * Escalate workflows through the multi-touch ladder.
 *   Touch 2: message_sent within 24h of appointment → send SMS reminder
 *   Touch 3: reminder_sent within 6h of appointment → send final warning
 */
async function escalateConfirmations(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ touch2: number; touch3: number }> {
  const now = new Date();
  const touch2Cutoff = new Date(now.getTime() + ESCALATION_TOUCH_2_HOURS_BEFORE * 60 * 60 * 1000);
  const touch3Cutoff = new Date(now.getTime() + ESCALATION_TOUCH_3_HOURS_BEFORE * 60 * 60 * 1000);

  const [t2Result, t3Result] = await Promise.all([
    escalateTouch2(supabase, tenantId, now, touch2Cutoff),
    escalateTouch3(supabase, tenantId, now, touch3Cutoff),
  ]);

  return { touch2: t2Result, touch3: t3Result };
}

async function escalateTouch2(
  supabase: SupabaseClient,
  tenantId: string,
  now: Date,
  touch2Cutoff: Date
): Promise<number> {
  const { data: workflows, error } = await supabase
    .from("confirmation_workflows")
    .select(`
      id, tenant_id, appointment_id, state, deadline_at,
      appointment:appointments(
        id, scheduled_at, service_name, provider_name, location_name,
        patient:patients(id, first_name, last_name, phone, preferred_channel)
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("state", "message_sent")
    .limit(BATCH_LIMIT);

  if (error || !workflows || workflows.length === 0) {
    if (error) console.error("[Engine] escalateTouch2 query error:", error);
    return 0;
  }

  let sent = 0;

  for (const wf of workflows as unknown as WorkflowRow[]) {
    try {
      const appt = wf.appointment;
      const patient = appt?.patient;
      if (!patient?.phone) continue;

      const scheduledAt = new Date(appt!.scheduled_at);
      if (scheduledAt > touch2Cutoff) continue;
      if (scheduledAt <= now) continue;

      const vars = buildTemplateVars(appt!, patient);
      const body = renderReminderSms(vars);

      const result = await sendMessage(supabase, {
        tenantId: wf.tenant_id,
        patientId: patient.id,
        patientPhone: patient.phone,
        channel: "sms" as MessageChannel,
        body,
        contextAppointmentId: wf.appointment_id,
      });

      if (result.success) {
        const ok = await markReminderSent(supabase, wf.id, scheduledAt);
        if (ok) {
          sent++;
          console.info(`[Engine] Touch 2 (SMS promemoria) inviato per workflow ${wf.id}`);
        }
      } else {
        console.error("[Engine] Touch 2 invio fallito per workflow:", wf.id, result.error);
      }
    } catch (err) {
      console.error("[Engine] Touch 2 errore per workflow:", wf.id, err);
    }
  }

  return sent;
}

async function escalateTouch3(
  supabase: SupabaseClient,
  tenantId: string,
  now: Date,
  touch3Cutoff: Date
): Promise<number> {
  const { data: workflows, error } = await supabase
    .from("confirmation_workflows")
    .select(`
      id, tenant_id, appointment_id, state, deadline_at,
      appointment:appointments(
        id, scheduled_at, service_name, provider_name, location_name,
        patient:patients(id, first_name, last_name, phone, preferred_channel)
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("state", "reminder_sent")
    .limit(BATCH_LIMIT);

  if (error || !workflows || workflows.length === 0) {
    if (error) console.error("[Engine] escalateTouch3 query error:", error);
    return 0;
  }

  let sent = 0;

  for (const wf of workflows as unknown as WorkflowRow[]) {
    try {
      const appt = wf.appointment;
      const patient = appt?.patient;
      if (!patient?.phone) continue;

      const scheduledAt = new Date(appt!.scheduled_at);
      if (scheduledAt > touch3Cutoff) continue;
      if (scheduledAt <= now) continue;

      const vars = buildTemplateVars(appt!, patient);
      const channel = (patient.preferred_channel as MessageChannel) ?? "whatsapp";
      const body =
        channel === "whatsapp"
          ? renderFinalWarningWhatsApp(vars)
          : renderFinalWarningSms(vars);

      const result = await sendMessage(supabase, {
        tenantId: wf.tenant_id,
        patientId: patient.id,
        patientPhone: patient.phone,
        channel,
        body,
        contextAppointmentId: wf.appointment_id,
      });

      if (result.success) {
        const ok = await markFinalWarningSent(supabase, wf.id);
        if (ok) {
          sent++;
          console.info(`[Engine] Touch 3 (avviso finale) inviato per workflow ${wf.id}`);
        }
      } else {
        console.error("[Engine] Touch 3 invio fallito per workflow:", wf.id, result.error);
      }
    } catch (err) {
      console.error("[Engine] Touch 3 errore per workflow:", wf.id, err);
    }
  }

  return sent;
}

/**
 * Find workflows in any active state past their deadline and mark them timed_out.
 * Triggers cascade backfill for each timed-out appointment.
 */
async function checkTimeouts(
  supabase: SupabaseClient,
  tenantId: string,
  now: string
): Promise<{ timedOut: number }> {
  const { data: workflows, error } = await supabase
    .from("confirmation_workflows")
    .select("id, tenant_id, appointment_id")
    .eq("tenant_id", tenantId)
    .in("state", ["message_sent", "reminder_sent", "final_warning_sent"])
    .lte("deadline_at", now)
    .limit(BATCH_LIMIT);

  if (error || !workflows || workflows.length === 0) {
    if (error) console.error("[Engine] checkTimeouts query error:", error);
    return { timedOut: 0 };
  }

  let timedOut = 0;

  for (const wf of workflows) {
    try {
      const ok = await markTimedOut(supabase, wf.id);
      if (!ok) continue;

      timedOut++;

      // Update appointment status to timeout (atomic guard on current status)
      await supabase
        .from("appointments")
        .update({ status: "timeout" })
        .eq("id", wf.appointment_id)
        .eq("tenant_id", wf.tenant_id)
        .in("status", ["scheduled", "reminder_sent", "reminder_pending"]);

      // Trigger cascade — fire-and-forget within the engine run
      triggerBackfill(supabase, wf.appointment_id, wf.tenant_id, { triggerEvent: "timeout" }).catch((err) => {
        console.error("[Engine] checkTimeouts cascade error for appointment:", wf.appointment_id, err);
      });
    } catch (err) {
      console.error("[Engine] checkTimeouts error for workflow:", wf.id, err);
    }
  }

  return { timedOut };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Build template variables from appointment + patient data. */
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
