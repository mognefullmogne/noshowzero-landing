// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { describe, it, expect } from "vitest";
import { computeCandidateScore } from "@/lib/scoring/candidate-score";

/** Create a Date that is `days` days after the open slot. */
function daysOut(openSlot: Date, days: number): Date {
  const d = new Date(openSlot);
  d.setDate(d.getDate() + days);
  return d;
}

describe("computeCandidateScore", () => {
  const openSlotAt = new Date("2026-04-01T10:00:00Z");

  it("scores appointment distance: 60+ days out gets max 60 points", () => {
    const result = computeCandidateScore({
      appointmentScheduledAt: daysOut(openSlotAt, 65),
      openSlotAt,
      patientNoShows: 0,
      patientTotal: 10,
    });

    expect(result.appointmentDistance).toBe(60);
  });

  it("scores appointment distance: 0-7 days out gets min 10 points", () => {
    const result = computeCandidateScore({
      appointmentScheduledAt: daysOut(openSlotAt, 3),
      openSlotAt,
      patientNoShows: 0,
      patientTotal: 10,
    });

    expect(result.appointmentDistance).toBe(10);
  });

  it("scores appointment distance: 14-30 days gets 35 points", () => {
    const result = computeCandidateScore({
      appointmentScheduledAt: daysOut(openSlotAt, 20),
      openSlotAt,
      patientNoShows: 0,
      patientTotal: 10,
    });

    expect(result.appointmentDistance).toBe(35);
  });

  it("scores reliability: perfect attendance gets 40 points", () => {
    const result = computeCandidateScore({
      appointmentScheduledAt: daysOut(openSlotAt, 10),
      openSlotAt,
      patientNoShows: 0,
      patientTotal: 5,
    });

    expect(result.reliability).toBe(40);
  });

  it("scores reliability: new patient (< 2 appts) gets neutral 20", () => {
    const result = computeCandidateScore({
      appointmentScheduledAt: daysOut(openSlotAt, 10),
      openSlotAt,
      patientNoShows: 0,
      patientTotal: 1,
    });

    expect(result.reliability).toBe(20);
  });

  it("scores reliability: 50% no-show rate gets 20 points", () => {
    const result = computeCandidateScore({
      appointmentScheduledAt: daysOut(openSlotAt, 10),
      openSlotAt,
      patientNoShows: 5,
      patientTotal: 10,
    });

    expect(result.reliability).toBe(20);
  });

  it("ranking: farther appointment always beats closer regardless of reliability", () => {
    // Patient A: 65 days out (appointmentDistance=60), poor reliability (noShows=8/10 → 8 pts)
    const patientA = computeCandidateScore({
      appointmentScheduledAt: daysOut(openSlotAt, 65),
      openSlotAt,
      patientNoShows: 8,
      patientTotal: 10,
    });

    // Patient B: 3 days out (appointmentDistance=10), perfect reliability (noShows=0/10 → 40 pts)
    const patientB = computeCandidateScore({
      appointmentScheduledAt: daysOut(openSlotAt, 3),
      openSlotAt,
      patientNoShows: 0,
      patientTotal: 10,
    });

    expect(patientA.total).toBeGreaterThan(patientB.total);
  });

  it("ranking: same distance band, better reliability wins", () => {
    // Both patients have appointments 20 days out (same distance band = 35 pts)
    const reliable = computeCandidateScore({
      appointmentScheduledAt: daysOut(openSlotAt, 20),
      openSlotAt,
      patientNoShows: 0,
      patientTotal: 10,
    });

    const unreliable = computeCandidateScore({
      appointmentScheduledAt: daysOut(openSlotAt, 22),
      openSlotAt,
      patientNoShows: 7,
      patientTotal: 10,
    });

    expect(reliable.appointmentDistance).toBe(unreliable.appointmentDistance);
    expect(reliable.total).toBeGreaterThan(unreliable.total);
  });
});
