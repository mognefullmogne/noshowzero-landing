import { CandidateScoreBreakdown } from "@/lib/types";

export interface CandidateScoreInput {
  readonly appointmentScheduledAt: Date; // candidate's current appointment
  readonly openSlotAt: Date;             // the cancelled slot time
  readonly patientNoShows: number;
  readonly patientTotal: number;
}

/**
 * Compute a candidate score for a patient who has a future appointment.
 *
 * Two-factor algorithm:
 *   - appointmentDistance (0-60, primary): Patients with farther-out appointments
 *     score higher because they benefit most from an earlier slot.
 *   - reliability (0-40, secondary/tiebreaker): Based on historical no-show rate.
 *
 * Pure function — no side effects, no mutations.
 */
export function computeCandidateScore(input: CandidateScoreInput): CandidateScoreBreakdown {
  const appointmentDistance = computeAppointmentDistance(
    input.appointmentScheduledAt,
    input.openSlotAt,
  );
  const reliability = computeReliability(input.patientNoShows, input.patientTotal);
  const total = appointmentDistance + reliability;

  return Object.freeze({
    total,
    appointmentDistance,
    reliability,
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
