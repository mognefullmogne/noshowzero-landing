// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Compute a candidate score for a patient who has a future appointment.
 *
 * Four-factor algorithm:
 *   - appointmentDistance (0-60, primary): Patients with farther-out appointments
 *     score higher because they benefit most from an earlier slot.
 *   - reliability (0-40, secondary/tiebreaker): Based on historical no-show rate.
 *   - urgencyBonus (0-20): How close the OPEN SLOT is to now. More urgent slots
 *     boost candidates to prioritize fast fills.
 *   - responsiveness (0-10): Based on patient's historical response speed.
 *     Fast responders get priority to maximize fill probability.
 *
 * Total max: 130. Stored as-is (weighted score, not normalized to 100).
 *
 * Pure function — no side effects, no mutations.
 */

import { CandidateScoreBreakdown } from "@/lib/types";

export interface CandidateScoreInput {
  readonly appointmentScheduledAt: Date; // candidate's current appointment
  readonly openSlotAt: Date;             // the cancelled slot time
  readonly patientNoShows: number;
  readonly patientTotal: number;
  readonly now?: Date;                   // injectable for testing (defaults to new Date())
  readonly avgResponseMinutes?: number | null; // from response patterns (null = no data)
}

export function computeCandidateScore(input: CandidateScoreInput): CandidateScoreBreakdown {
  const now = input.now ?? new Date();

  const appointmentDistance = computeAppointmentDistance(
    input.appointmentScheduledAt,
    input.openSlotAt,
  );
  const reliability = computeReliability(input.patientNoShows, input.patientTotal);
  const urgencyBonus = computeUrgencyBonus(input.openSlotAt, now);
  const responsiveness = computeResponsiveness(input.avgResponseMinutes ?? null);
  const total = appointmentDistance + reliability + urgencyBonus + responsiveness;

  return Object.freeze({
    total,
    appointmentDistance,
    reliability,
    urgencyBonus,
    responsiveness,
  });
}

function computeAppointmentDistance(appointmentAt: Date, openSlotAt: Date): number {
  const diffMs = appointmentAt.getTime() - openSlotAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 7) return 10;
  if (diffDays < 14) return 20;
  if (diffDays < 30) return 35;
  if (diffDays < 60) return 45;
  return 60;
}

function computeReliability(noShows: number, total: number): number {
  if (total < 2) {
    return 20; // neutral for new patients
  }
  return Math.round((1 - noShows / total) * 40);
}

/**
 * Urgency bonus: how close the open slot is to NOW.
 * Slots filling up fast get a boost to prioritize quick responders.
 */
function computeUrgencyBonus(openSlotAt: Date, now: Date): number {
  const hoursUntilSlot = (openSlotAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilSlot < 2) return 20;
  if (hoursUntilSlot < 6) return 15;
  if (hoursUntilSlot < 12) return 10;
  if (hoursUntilSlot < 24) return 5;
  return 0;
}

/**
 * Responsiveness score: based on patient's historical avg response time.
 * Null means no data — score 0 (conservative, no bonus).
 */
function computeResponsiveness(avgResponseMinutes: number | null): number {
  if (avgResponseMinutes === null) return 0;

  if (avgResponseMinutes < 5) return 10;
  if (avgResponseMinutes < 30) return 7;
  if (avgResponseMinutes < 60) return 4;
  return 0;
}
