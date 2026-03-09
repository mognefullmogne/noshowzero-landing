// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Confirmation workflow state machine (serverless, DB-driven).
 * States: pending_send -> message_sent -> reminder_sent -> final_warning_sent -> confirmed | declined | timed_out | cancelled
 *
 * Multi-touch escalation:
 *   Touch 1: WhatsApp confirmation (message_sent) — default 48h before
 *   Touch 2: SMS reminder (reminder_sent) — 24h before
 *   Touch 3: Final warning (final_warning_sent) — 6h before
 *   After Touch 3 + 2h with no response -> timed_out -> cascade
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfirmationState } from "@/lib/types";
import { calculateConfirmationDeadline } from "./timing";

const SEND_HOURS_BEFORE = parseInt(process.env.CONFIRMATION_SEND_HOURS_BEFORE ?? "48", 10);
const TIMEOUT_HOURS = parseInt(process.env.CONFIRMATION_TIMEOUT_HOURS ?? "24", 10);

/** Hours before appointment for each escalation touch. */
export const ESCALATION_TOUCH_2_HOURS_BEFORE = 24;
export const ESCALATION_TOUCH_3_HOURS_BEFORE = 6;
/** Hours after final warning before timing out. */
export const FINAL_WARNING_TIMEOUT_HOURS = 2;

const VALID_WORKFLOW_TRANSITIONS: Record<ConfirmationState, readonly ConfirmationState[]> = {
  pending_send: ["notification_sent", "confirmed", "cancelled"],
  notification_sent: ["message_sent", "confirmed", "cancelled"],
  message_sent: ["reminder_sent", "confirmed", "declined", "timed_out", "cancelled"],
  reminder_sent: ["final_warning_sent", "confirmed", "declined", "timed_out", "cancelled"],
  final_warning_sent: ["confirmed", "declined", "timed_out", "cancelled"],
  confirmed: [],
  declined: [],
  timed_out: [],
  cancelled: [],
};

export function canTransition(from: ConfirmationState, to: ConfirmationState): boolean {
  return VALID_WORKFLOW_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Create a confirmation workflow for a new appointment.
 * Uses risk-based timing when riskScore is provided, otherwise falls back
 * to the default SEND_HOURS_BEFORE (48h).
 */
export async function createConfirmationWorkflow(
  supabase: SupabaseClient,
  tenantId: string,
  appointmentId: string,
  scheduledAt: Date,
  riskScore?: number | null
): Promise<string | null> {
  const deadlineAt = riskScore !== undefined
    ? calculateConfirmationDeadline(scheduledAt, riskScore)
    : new Date(scheduledAt.getTime() - SEND_HOURS_BEFORE * 60 * 60 * 1000);

  // Don't create if deadline is already passed
  if (deadlineAt <= new Date()) {
    return null;
  }

  const { data, error } = await supabase
    .from("confirmation_workflows")
    .insert({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      state: "pending_send",
      deadline_at: deadlineAt.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[Workflow] Failed to create confirmation workflow:", error);
    return null;
  }

  return data.id;
}

/**
 * Transition a workflow to notification_sent after sending the initial
 * informational notification. The workflow deadline stays unchanged —
 * the cron will pick it up later to send the real confirmation (Touch 1).
 */
export async function markNotificationSent(
  supabase: SupabaseClient,
  workflowId: string,
  messageEventId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("confirmation_workflows")
    .update({
      state: "notification_sent",
      message_event_id: messageEventId,
    })
    .eq("id", workflowId)
    .eq("state", "pending_send");

  return !error;
}

/**
 * Transition a workflow to message_sent state after sending Touch 1
 * confirmation request (SI/NO). Sets deadline for timeout check
 * (NOW + TIMEOUT_HOURS).
 */
export async function markMessageSent(
  supabase: SupabaseClient,
  workflowId: string,
  messageEventId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("confirmation_workflows")
    .update({
      state: "message_sent",
      message_event_id: messageEventId,
      deadline_at: new Date(Date.now() + TIMEOUT_HOURS * 60 * 60 * 1000).toISOString(),
      attempts: 1,
    })
    .eq("id", workflowId)
    .in("state", ["notification_sent", "pending_send"]);

  return !error;
}

/**
 * Transition a workflow to reminder_sent state (Touch 2).
 * Sets deadline to appointment time - ESCALATION_TOUCH_3_HOURS_BEFORE (6h before).
 */
export async function markReminderSent(
  supabase: SupabaseClient,
  workflowId: string,
  scheduledAt: Date
): Promise<boolean> {
  const touch3Deadline = new Date(
    scheduledAt.getTime() - ESCALATION_TOUCH_3_HOURS_BEFORE * 60 * 60 * 1000
  );

  const { error } = await supabase
    .from("confirmation_workflows")
    .update({
      state: "reminder_sent",
      deadline_at: touch3Deadline.toISOString(),
      attempts: 2,
    })
    .eq("id", workflowId)
    .eq("state", "message_sent");

  return !error;
}

/**
 * Transition a workflow to final_warning_sent state (Touch 3).
 * Sets deadline to NOW + FINAL_WARNING_TIMEOUT_HOURS (2h).
 */
export async function markFinalWarningSent(
  supabase: SupabaseClient,
  workflowId: string
): Promise<boolean> {
  const timeoutDeadline = new Date(
    Date.now() + FINAL_WARNING_TIMEOUT_HOURS * 60 * 60 * 1000
  );

  const { error } = await supabase
    .from("confirmation_workflows")
    .update({
      state: "final_warning_sent",
      deadline_at: timeoutDeadline.toISOString(),
      attempts: 3,
    })
    .eq("id", workflowId)
    .eq("state", "reminder_sent");

  return !error;
}

/**
 * Transition a workflow to timed_out state.
 * Accepts workflows in message_sent, reminder_sent, or final_warning_sent states.
 */
export async function markTimedOut(
  supabase: SupabaseClient,
  workflowId: string
): Promise<boolean> {
  // Try each escalation state — only one will succeed per workflow
  const { error } = await supabase
    .from("confirmation_workflows")
    .update({ state: "timed_out" })
    .eq("id", workflowId)
    .in("state", ["message_sent", "reminder_sent", "final_warning_sent"]);

  return !error;
}
