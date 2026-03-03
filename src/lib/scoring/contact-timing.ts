/**
 * Contact timing / reminder schedule logic.
 * Ported from NestJS ContactTimingService.
 *
 * Determines when and how to contact a patient based on their risk score.
 */

import type { ContactScheduleEntry, MessageChannel } from "@/lib/types";

const DEFAULT_SEND_HOURS_BEFORE = 48;

/**
 * Generate a reminder schedule based on risk score.
 * High-risk patients get an extra early reminder at 72h before.
 */
export function generateContactSchedule(
  riskScore: number,
  preferredChannel: MessageChannel = "email",
  sendHoursBefore: number = DEFAULT_SEND_HOURS_BEFORE
): readonly ContactScheduleEntry[] {
  const schedule: ContactScheduleEntry[] = [];

  // High risk: add an extra urgent reminder 72h before
  if (riskScore >= 60) {
    schedule.push({
      hoursBefore: 72,
      channel: preferredChannel,
      messageTone: "urgent",
    });
  }

  // Standard reminder at configured hours before
  schedule.push({
    hoursBefore: sendHoursBefore,
    channel: preferredChannel,
    messageTone: "standard",
  });

  // Sort descending by hoursBefore (earliest first)
  return schedule.sort((a, b) => b.hoursBefore - a.hoursBefore);
}

/**
 * Convert a contact schedule into actual reminder times for an appointment.
 */
export function scheduleToReminders(
  appointmentScheduledAt: Date,
  schedule: readonly ContactScheduleEntry[]
): readonly { scheduledAt: Date; channel: MessageChannel; messageTone: string }[] {
  const now = new Date();
  return schedule
    .map((entry) => {
      const reminderTime = new Date(
        appointmentScheduledAt.getTime() - entry.hoursBefore * 3_600_000
      );
      return {
        scheduledAt: reminderTime > now ? reminderTime : now,
        channel: entry.channel,
        messageTone: entry.messageTone,
      };
    })
    .filter((r) => r.scheduledAt > now);
}
