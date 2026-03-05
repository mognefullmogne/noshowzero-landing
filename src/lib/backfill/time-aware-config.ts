// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Time-aware cascade speed configuration.
 *
 * Adjusts offer expiry and parallel outreach based on how close
 * the appointment slot is:
 *
 *   24+ hours: 60-min expiry, 1 candidate at a time (standard)
 *   4-24 hours: 30-min expiry, 1 candidate at a time
 *   1-4 hours: 15-min expiry, 3 candidates simultaneously
 *   <1 hour: 10-min expiry, 5 candidates simultaneously, "URGENTE" prefix
 */

export type UrgencyTier = "standard" | "accelerated" | "urgent" | "critical";

export interface TimeAwareConfig {
  readonly tier: UrgencyTier;
  readonly expiryMinutes: number;
  readonly parallelCount: number;
  readonly urgencyPrefix: string | null;
}

const CONFIGS: Record<UrgencyTier, Omit<TimeAwareConfig, "tier">> = {
  standard: {
    expiryMinutes: 60,
    parallelCount: 1,
    urgencyPrefix: null,
  },
  accelerated: {
    expiryMinutes: 30,
    parallelCount: 1,
    urgencyPrefix: null,
  },
  urgent: {
    expiryMinutes: 15,
    parallelCount: 3,
    urgencyPrefix: null,
  },
  critical: {
    expiryMinutes: 10,
    parallelCount: 5,
    urgencyPrefix: "URGENTE",
  },
} as const;

/**
 * Determine the time-aware cascade configuration for a given slot time.
 */
export function getTimeAwareConfig(scheduledAt: Date): TimeAwareConfig {
  const hoursUntilSlot = (scheduledAt.getTime() - Date.now()) / (60 * 60 * 1000);

  if (hoursUntilSlot < 1) {
    return { tier: "critical", ...CONFIGS.critical };
  }
  if (hoursUntilSlot < 4) {
    return { tier: "urgent", ...CONFIGS.urgent };
  }
  if (hoursUntilSlot < 24) {
    return { tier: "accelerated", ...CONFIGS.accelerated };
  }
  return { tier: "standard", ...CONFIGS.standard };
}

/**
 * Calculate the expiry time for an offer given the slot time.
 */
export function calculateOfferExpiry(scheduledAt: Date): Date {
  const config = getTimeAwareConfig(scheduledAt);
  return new Date(Date.now() + config.expiryMinutes * 60 * 1000);
}
