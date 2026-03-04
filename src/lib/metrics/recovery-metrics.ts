/**
 * Pure functions for honest recovery metric calculations.
 *
 * "Recovered" means ONLY appointments created via accepted waitlist_offers
 * (new_appointment_id IS NOT NULL). Regular confirmations, completed
 * appointments, and fulfilled waitlist_entries are NOT recoveries.
 */

import type { RecoveryMetrics } from "@/lib/types";

interface RecoveryMetricsParams {
  readonly cancelledCount: number;
  readonly noShowCount: number;
  readonly acceptedOffersWithNewAppt: number;
  readonly pendingOffersCount: number;
  readonly avgAppointmentValue: number;
}

/**
 * Fill rate per METR-04: (slots filled via recovery) / (cancelled + no-show) x 100.
 * Returns 0 if denominator is 0 to avoid division-by-zero.
 */
export function computeFillRate(
  slotsFilledViaRecovery: number,
  totalCancelledOrNoShow: number
): number {
  if (totalCancelledOrNoShow === 0) return 0;
  return Math.round((slotsFilledViaRecovery / totalCancelledOrNoShow) * 100);
}

/**
 * Revenue recovered = slots filled * tenant's average appointment value.
 * Rounds to nearest integer to avoid floating-point display noise.
 */
export function computeRevenueRecovered(
  slotsFilledViaRecovery: number,
  avgAppointmentValue: number
): number {
  return Math.round(slotsFilledViaRecovery * avgAppointmentValue);
}

/**
 * Orchestrator: computes all recovery metrics from raw counts.
 * slotsRecovered = acceptedOffersWithNewAppt (honest metric per METR-01).
 */
export function computeRecoveryMetrics(
  params: RecoveryMetricsParams
): RecoveryMetrics {
  const totalCancelledOrNoShow =
    params.cancelledCount + params.noShowCount;
  const slotsRecovered = params.acceptedOffersWithNewAppt;
  const slotsLost = totalCancelledOrNoShow - slotsRecovered;
  const fillRatePercent = computeFillRate(
    slotsRecovered,
    totalCancelledOrNoShow
  );
  const revenueRecovered = computeRevenueRecovered(
    slotsRecovered,
    params.avgAppointmentValue
  );

  return {
    slotsRecovered,
    slotsLost,
    totalCancelledOrNoShow,
    fillRatePercent,
    revenueRecovered,
    activeOffers: params.pendingOffersCount,
  };
}
