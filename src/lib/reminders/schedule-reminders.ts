/**
 * Eager reminder scheduling — creates reminder rows at appointment creation time.
 * Also used by the cron endpoint as a safety net for missed schedules.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateContactSchedule, scheduleToReminders } from "@/lib/scoring/contact-timing";
import type { MessageChannel } from "@/lib/types";

interface ScheduleInput {
  readonly appointmentId: string;
  readonly tenantId: string;
  readonly scheduledAt: Date;
  readonly riskScore: number;
  readonly preferredChannel: MessageChannel;
}

/**
 * Create reminder rows for an appointment if none exist yet.
 */
export async function ensureRemindersScheduled(
  supabase: SupabaseClient,
  input: ScheduleInput
): Promise<number> {
  // Check if any reminders already exist (pending, sent, or cancelled)
  // to avoid re-creating reminders that were already processed
  const { count } = await supabase
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("appointment_id", input.appointmentId);

  if ((count ?? 0) > 0) return 0;

  const schedule = generateContactSchedule(input.riskScore, input.preferredChannel);
  const reminderTimes = scheduleToReminders(input.scheduledAt, schedule);

  if (reminderTimes.length === 0) return 0;

  const rows = reminderTimes.map((r) => ({
    tenant_id: input.tenantId,
    appointment_id: input.appointmentId,
    channel: r.channel,
    message_tone: r.messageTone,
    scheduled_at: r.scheduledAt.toISOString(),
    status: "pending",
  }));

  const { error } = await supabase.from("reminders").insert(rows);
  if (error) {
    console.error("Failed to schedule reminders:", error);
    return 0;
  }

  return rows.length;
}
