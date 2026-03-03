/**
 * Confirmation workflow state machine (serverless, DB-driven).
 * States: pending_send → message_sent → confirmed | declined | timed_out | cancelled
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfirmationState } from "@/lib/types";

const SEND_HOURS_BEFORE = parseInt(process.env.CONFIRMATION_SEND_HOURS_BEFORE ?? "48", 10);
const TIMEOUT_HOURS = parseInt(process.env.CONFIRMATION_TIMEOUT_HOURS ?? "24", 10);

const VALID_WORKFLOW_TRANSITIONS: Record<ConfirmationState, readonly ConfirmationState[]> = {
  pending_send: ["message_sent", "confirmed", "cancelled"],
  message_sent: ["confirmed", "declined", "timed_out", "cancelled"],
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
 * The deadline is set to scheduled_at - SEND_HOURS_BEFORE hours.
 */
export async function createConfirmationWorkflow(
  supabase: SupabaseClient,
  tenantId: string,
  appointmentId: string,
  scheduledAt: Date
): Promise<string | null> {
  const deadlineAt = new Date(scheduledAt.getTime() - SEND_HOURS_BEFORE * 60 * 60 * 1000);

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
 * Transition a workflow to message_sent state after sending confirmation.
 * Sets new deadline for timeout check (NOW + TIMEOUT_HOURS).
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
    .eq("state", "pending_send");

  return !error;
}

/**
 * Transition a workflow to timed_out state.
 */
export async function markTimedOut(
  supabase: SupabaseClient,
  workflowId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("confirmation_workflows")
    .update({ state: "timed_out" })
    .eq("id", workflowId)
    .eq("state", "message_sent");

  return !error;
}
