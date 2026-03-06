// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Deterministic risk scoring (0–100).
 * Ported from NestJS AppointmentsService.computeRiskScore()
 *
 * Components:
 *   history  (0–40) — patient no-show rate
 *   dayOfWeek(0–15) — high-risk days
 *   hour     (0–15) — high-risk hours
 *   leadTime (0–30) — days between booking and appointment
 */

interface RiskScoreInput {
  readonly totalAppointments: number;
  readonly noShows: number;
  readonly scheduledAt: Date;
  readonly createdAt: Date;
}

interface RiskScoreResult {
  readonly score: number;
  readonly breakdown: {
    readonly history: number;
    readonly dayOfWeek: number;
    readonly hour: number;
    readonly leadTime: number;
  };
  readonly reasoning: string;
}

/** Extract day-of-week (0=Sun) and hour (0-23) in Europe/Rome timezone. */
function getRomeTimeParts(date: Date): { dayOfWeek: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "12";

  return {
    dayOfWeek: weekdayMap[weekdayStr] ?? 1,
    hour: parseInt(hourStr, 10),
  };
}

export function computeRiskScore(input: RiskScoreInput): RiskScoreResult {
  const { totalAppointments, noShows, scheduledAt, createdAt } = input;
  let score = 0;

  // 1. Historical no-show rate (0–40)
  let history: number;
  if (totalAppointments >= 3) {
    history = Math.round((noShows / totalAppointments) * 40);
  } else {
    history = 15; // new patient moderate baseline
  }
  score += history;

  // 2. Day of week (0–15) — use Europe/Rome timezone
  const { dayOfWeek, hour } = getRomeTimeParts(scheduledAt);
  let dayScore: number;
  if (dayOfWeek === 1) {
    dayScore = 15; // Monday
  } else if (dayOfWeek === 5) {
    dayScore = 10; // Friday
  } else if (dayOfWeek === 0 || dayOfWeek === 6) {
    dayScore = 5; // Weekend
  } else {
    dayScore = 0;
  }
  score += dayScore;

  // 3. Time of day (0–15) — uses Rome hour extracted above
  let hourScore: number;
  if (hour < 9) {
    hourScore = 15; // early morning
  } else if (hour >= 17) {
    hourScore = 10; // late afternoon
  } else {
    hourScore = 0;
  }
  score += hourScore;

  // 4. Lead time (0–30)
  const leadMs = Math.max(0, scheduledAt.getTime() - createdAt.getTime());
  const leadDays = leadMs / 86_400_000;
  let leadScore: number;
  if (leadDays > 21) {
    leadScore = 30;
  } else if (leadDays > 14) {
    leadScore = 20;
  } else if (leadDays > 7) {
    leadScore = 10;
  } else {
    leadScore = 5;
  }
  score += leadScore;

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));

  const parts: string[] = [];
  if (totalAppointments >= 3) {
    parts.push(
      `Patient has ${noShows}/${totalAppointments} no-shows (${Math.round((noShows / totalAppointments) * 100)}%)`
    );
  } else {
    parts.push("New patient — limited history, moderate baseline risk");
  }
  if (dayScore > 0) parts.push(`Scheduled on a high-risk day (+${dayScore})`);
  if (hourScore > 0) parts.push(`Scheduled at a high-risk hour (+${hourScore})`);
  if (leadScore >= 20) parts.push(`Long lead time of ${Math.round(leadDays)} days (+${leadScore})`);

  return {
    score: finalScore,
    breakdown: { history, dayOfWeek: dayScore, hour: hourScore, leadTime: leadScore },
    reasoning: parts.join(". ") + ".",
  };
}

export function riskLevel(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}
