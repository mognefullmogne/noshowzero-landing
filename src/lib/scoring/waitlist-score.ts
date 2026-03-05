// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Smart waitlist scoring (0–100).
 * Ported from NestJS MatchingService.computeSmartScore()
 *
 * Components:
 *   urgency       (0–25)
 *   reliability   (0–25)
 *   timePreference(0–20)
 *   waitingTime   (0–15)
 *   distance      (0–10)
 *   providerMatch (0–3)
 *   paymentMatch  (0–2)
 */

import type { ClinicalUrgency, SmartScoreBreakdown, TimeSlot } from "@/lib/types";

interface WaitlistScoreInput {
  readonly clinicalUrgency: ClinicalUrgency;
  readonly patientNoShows: number;
  readonly patientTotal: number;
  readonly preferredTimeSlots: readonly TimeSlot[];
  readonly createdAt: Date;
  readonly distanceKm: number | null;
  readonly preferredProvider: string | null;
  readonly slotProvider?: string | null;
  readonly paymentCategory: string | null;
  readonly slotPaymentCategory?: string | null;
  readonly slotStartsAt?: Date;
}

export function computeWaitlistScore(input: WaitlistScoreInput): SmartScoreBreakdown {
  const urgency = scoreUrgency(input.clinicalUrgency);
  const reliability = scoreReliability(input.patientNoShows, input.patientTotal);
  const timePreference = input.slotStartsAt
    ? scoreTimePreference(input.slotStartsAt, input.preferredTimeSlots)
    : 10; // neutral when no slot to compare
  const waitingTime = scoreWaitingTime(input.createdAt);
  const distance = scoreDistance(input.distanceKm);
  const providerMatch =
    input.preferredProvider && input.slotProvider && input.preferredProvider === input.slotProvider
      ? 3
      : 0;
  const paymentMatch =
    input.paymentCategory && input.slotPaymentCategory && input.paymentCategory === input.slotPaymentCategory
      ? 2
      : 0;

  const total = urgency + reliability + timePreference + waitingTime + distance + providerMatch + paymentMatch;

  return { total, urgency, reliability, timePreference, waitingTime, distance, providerMatch, paymentMatch };
}

function scoreUrgency(urgency: ClinicalUrgency): number {
  switch (urgency) {
    case "critical": return 25;
    case "high": return 22;
    case "medium": return 16;
    case "low": return 8;
    case "none": return 0;
  }
}

function scoreReliability(noShows: number, total: number): number {
  if (total < 2) return 12; // neutral — insufficient data
  return Math.round((1 - noShows / total) * 25);
}

function scoreTimePreference(slotStartsAt: Date, preferredSlots: readonly TimeSlot[]): number {
  if (preferredSlots.length === 0) return 10; // flexible
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const slotDay = dayNames[slotStartsAt.getUTCDay()];
  const slotMinutes = slotStartsAt.getUTCHours() * 60 + slotStartsAt.getUTCMinutes();

  for (const pref of preferredSlots) {
    if (pref.day !== slotDay) continue;
    const [fromH, fromM] = pref.from.split(":").map(Number);
    const [toH, toM] = pref.to.split(":").map(Number);
    const fromMin = fromH * 60 + fromM;
    const toMin = toH * 60 + toM;
    if (slotMinutes >= fromMin && slotMinutes < toMin) return 20;
  }
  return 0;
}

function scoreWaitingTime(createdAt: Date): number {
  const days = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
  if (days >= 90) return 15;
  if (days >= 30) return 10;
  if (days >= 7) return 5;
  return 0;
}

function scoreDistance(distanceKm: number | null | undefined): number {
  if (distanceKm == null) return 5; // neutral
  if (distanceKm <= 5) return 10;
  if (distanceKm <= 15) return 5;
  return 0;
}

export function fitLabel(score: number): "EXCELLENT_FIT" | "GOOD_FIT" | "PARTIAL_FIT" {
  if (score >= 70) return "EXCELLENT_FIT";
  if (score >= 40) return "GOOD_FIT";
  return "PARTIAL_FIT";
}

/**
 * Calculate the static initial priority score for a new waitlist entry.
 */
export function calculateInitialPriority(input: {
  readonly flexibleTime: boolean;
  readonly requireSameProvider?: boolean;
  readonly requireSamePayment?: boolean;
  readonly clinicalUrgency: ClinicalUrgency;
}): { score: number; reason: string } {
  let base = 50;
  if (input.flexibleTime) base += 10;
  if (input.requireSameProvider) base -= 10;
  if (input.requireSamePayment) base -= 5;

  const urgencyBonus: Record<ClinicalUrgency, number> = {
    critical: 25,
    high: 18,
    medium: 10,
    low: 4,
    none: 0,
  };
  base += urgencyBonus[input.clinicalUrgency];

  const score = Math.min(100, Math.max(0, base));
  const reason = score >= 70 ? "EXCELLENT_FIT" : score >= 40 ? "GOOD_FIT" : "PARTIAL_FIT";
  return { score, reason };
}
