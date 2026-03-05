// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Risk-based confirmation timing.
 *
 * Adjusts when confirmation messages are sent based on patient risk score:
 *   Critical (>=75): 72h before — earliest possible, max urgency
 *   High (50-74): 48h before — current default
 *   Medium (25-49): 36h before — moderate lead time
 *   Low (<25): 24h before — minimal lead time for reliable patients
 *
 * Higher-risk patients get confirmed earlier, giving more time for
 * escalation and cascade backfill if they don't respond.
 */

export type RiskTier = "critical" | "high" | "medium" | "low";

interface RiskTimingConfig {
  readonly tier: RiskTier;
  readonly sendHoursBefore: number;
  readonly minRiskScore: number;
}

const RISK_TIMING_TIERS: readonly RiskTimingConfig[] = [
  { tier: "critical", sendHoursBefore: 72, minRiskScore: 75 },
  { tier: "high", sendHoursBefore: 48, minRiskScore: 50 },
  { tier: "medium", sendHoursBefore: 36, minRiskScore: 25 },
  { tier: "low", sendHoursBefore: 24, minRiskScore: 0 },
] as const;

/**
 * Determine the risk tier for a given risk score.
 * Returns "high" (48h) as default when no risk score is available.
 */
export function getRiskTier(riskScore: number | null): RiskTier {
  if (riskScore === null) return "high"; // default to 48h when unknown

  for (const config of RISK_TIMING_TIERS) {
    if (riskScore >= config.minRiskScore) {
      return config.tier;
    }
  }

  return "low";
}

/**
 * Get the number of hours before appointment to send confirmation,
 * based on the patient's risk score.
 */
export function getConfirmationHoursBefore(riskScore: number | null): number {
  const tier = getRiskTier(riskScore);
  const config = RISK_TIMING_TIERS.find((t) => t.tier === tier);
  return config?.sendHoursBefore ?? 48;
}

/**
 * Calculate the deadline (when to send the confirmation) based on
 * appointment time and risk score.
 */
export function calculateConfirmationDeadline(
  scheduledAt: Date,
  riskScore: number | null
): Date {
  const hoursBefore = getConfirmationHoursBefore(riskScore);
  return new Date(scheduledAt.getTime() - hoursBefore * 60 * 60 * 1000);
}
