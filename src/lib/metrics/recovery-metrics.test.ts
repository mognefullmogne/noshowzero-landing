import { describe, it, expect } from "vitest";
import {
  computeFillRate,
  computeRevenueRecovered,
  computeRecoveryMetrics,
} from "./recovery-metrics";

describe("computeFillRate", () => {
  it("returns correct percentage for partial fill", () => {
    expect(computeFillRate(3, 10)).toBe(30);
  });

  it("returns 0 when no cancelled or no-show appointments exist", () => {
    expect(computeFillRate(0, 0)).toBe(0);
  });

  it("returns 100 when all slots are recovered", () => {
    expect(computeFillRate(5, 5)).toBe(100);
  });

  it("returns 0 when no slots are recovered", () => {
    expect(computeFillRate(0, 10)).toBe(0);
  });

  it("rounds to nearest integer", () => {
    // 1/3 = 33.333...% -> 33
    expect(computeFillRate(1, 3)).toBe(33);
  });
});

describe("computeRevenueRecovered", () => {
  it("returns slots * avg appointment value", () => {
    expect(computeRevenueRecovered(3, 150)).toBe(450);
  });

  it("returns 0 when no slots are recovered", () => {
    expect(computeRevenueRecovered(0, 150)).toBe(0);
  });

  it("handles decimal appointment values", () => {
    expect(computeRevenueRecovered(2, 80.5)).toBe(161);
  });
});

describe("computeRecoveryMetrics", () => {
  it("correctly computes all metrics from mixed data", () => {
    const result = computeRecoveryMetrics({
      cancelledCount: 5,
      noShowCount: 5,
      acceptedOffersWithNewAppt: 3,
      pendingOffersCount: 2,
      avgAppointmentValue: 150,
    });

    expect(result.slotsRecovered).toBe(3);
    expect(result.slotsLost).toBe(7); // 10 total - 3 recovered
    expect(result.totalCancelledOrNoShow).toBe(10);
    expect(result.fillRatePercent).toBe(30);
    expect(result.revenueRecovered).toBe(450);
    expect(result.activeOffers).toBe(2);
  });

  it("excludes regular confirmations from recovery count", () => {
    // Even if many appointments are confirmed, recovery is ONLY
    // based on accepted offers with new_appointment_id
    const result = computeRecoveryMetrics({
      cancelledCount: 10,
      noShowCount: 0,
      acceptedOffersWithNewAppt: 0,
      pendingOffersCount: 0,
      avgAppointmentValue: 150,
    });

    expect(result.slotsRecovered).toBe(0);
    expect(result.revenueRecovered).toBe(0);
    expect(result.fillRatePercent).toBe(0);
    expect(result.slotsLost).toBe(10);
  });

  it("handles zero cancelled and zero no-show", () => {
    const result = computeRecoveryMetrics({
      cancelledCount: 0,
      noShowCount: 0,
      acceptedOffersWithNewAppt: 0,
      pendingOffersCount: 0,
      avgAppointmentValue: 80,
    });

    expect(result.slotsRecovered).toBe(0);
    expect(result.totalCancelledOrNoShow).toBe(0);
    expect(result.fillRatePercent).toBe(0);
    expect(result.revenueRecovered).toBe(0);
    expect(result.slotsLost).toBe(0);
    expect(result.activeOffers).toBe(0);
  });

  it("handles large numbers correctly", () => {
    const result = computeRecoveryMetrics({
      cancelledCount: 5000,
      noShowCount: 3000,
      acceptedOffersWithNewAppt: 2400,
      pendingOffersCount: 100,
      avgAppointmentValue: 200,
    });

    expect(result.slotsRecovered).toBe(2400);
    expect(result.totalCancelledOrNoShow).toBe(8000);
    expect(result.fillRatePercent).toBe(30);
    expect(result.revenueRecovered).toBe(480000);
    expect(result.slotsLost).toBe(5600);
    expect(result.activeOffers).toBe(100);
  });

  it("handles 100% recovery rate", () => {
    const result = computeRecoveryMetrics({
      cancelledCount: 2,
      noShowCount: 3,
      acceptedOffersWithNewAppt: 5,
      pendingOffersCount: 0,
      avgAppointmentValue: 80,
    });

    expect(result.fillRatePercent).toBe(100);
    expect(result.slotsLost).toBe(0);
    expect(result.revenueRecovered).toBe(400);
  });
});
