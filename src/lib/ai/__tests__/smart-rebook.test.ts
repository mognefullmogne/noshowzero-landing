// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Test the pure slot-scoring logic extracted from smart-rebook
// ---------------------------------------------------------------------------

interface RebookingSlot {
  startAt: string;
  preferredDay: boolean;
  preferredHour: boolean;
}

/** Mirrors the scoring logic in generateRebookingSuggestions */
function scoreSlots(
  slots: ReadonlyArray<{ startAt: string }>,
  preferredDays: readonly number[],
  preferredHours: readonly number[]
): Array<{ startAt: string; score: number }> {
  return slots.map((slot) => {
    const d = new Date(slot.startAt);
    const dayScore = preferredDays.indexOf(d.getUTCDay());
    const hourScore = preferredHours.indexOf(d.getUTCHours());
    const score =
      (dayScore !== -1 ? 3 - dayScore : 0) +
      (hourScore !== -1 ? 3 - hourScore : 0);
    return { startAt: slot.startAt, score };
  });
}

describe("smart-rebook slot scoring", () => {
  it("scores a slot matching top preferred day and hour highest", () => {
    // Monday (day 1) at 10:00 UTC — both are top preferences
    const monday10 = "2026-03-09T10:00:00.000Z"; // Monday
    const tuesday14 = "2026-03-10T14:00:00.000Z"; // Tuesday

    const scored = scoreSlots(
      [{ startAt: monday10 }, { startAt: tuesday14 }],
      [1, 2, 3],    // Mon, Tue, Wed preferred
      [10, 14, 9]   // 10h, 14h, 9h preferred
    );

    // monday10: day=Mon→index 0→score 3; hour=10h→index 0→score 3 = 6
    // tuesday14: day=Tue→index 1→score 2; hour=14h→index 1→score 2 = 4
    const sorted = scored.sort((a, b) => b.score - a.score);
    expect(sorted[0].startAt).toBe(monday10);
    expect(sorted[0].score).toBe(6);
    expect(sorted[1].score).toBe(4);
  });

  it("scores 0 for a slot with no matching preferred day or hour", () => {
    const sunday5 = "2026-03-08T05:00:00.000Z"; // Sunday at 5am
    const scored = scoreSlots(
      [{ startAt: sunday5 }],
      [1, 2, 3],  // Mon, Tue, Wed
      [10, 14]    // 10h, 14h
    );
    expect(scored[0].score).toBe(0);
  });

  it("scores partial match (day only) correctly", () => {
    const monday5 = "2026-03-09T05:00:00.000Z"; // Monday (preferred) at 5am (not preferred)
    const scored = scoreSlots(
      [{ startAt: monday5 }],
      [1, 2, 3],  // Mon top
      [10, 14]    // 5h not in list
    );
    // day Mon → index 0 → score 3; hour 5h → not found → 0
    expect(scored[0].score).toBe(3);
  });

  it("scores partial match (hour only) correctly", () => {
    const sunday10 = "2026-03-08T10:00:00.000Z"; // Sunday (not preferred) at 10am (preferred)
    const scored = scoreSlots(
      [{ startAt: sunday10 }],
      [1, 2, 3],  // Mon,Tue,Wed
      [10, 14]    // 10h is top
    );
    // day Sun → not found → 0; hour 10h → index 0 → score 3
    expect(scored[0].score).toBe(3);
  });

  it("handles empty slot list", () => {
    const scored = scoreSlots([], [1, 2], [10, 14]);
    expect(scored).toHaveLength(0);
  });

  it("handles empty preferences (all zeros)", () => {
    const slot = "2026-03-09T10:00:00.000Z";
    const scored = scoreSlots([{ startAt: slot }], [], []);
    expect(scored[0].score).toBe(0);
  });

  it("scores second preferred day lower than first", () => {
    const monday = "2026-03-09T10:00:00.000Z"; // Monday, day 1
    const tuesday = "2026-03-10T10:00:00.000Z"; // Tuesday, day 2
    const scored = scoreSlots(
      [{ startAt: monday }, { startAt: tuesday }],
      [1, 2],  // Mon first, Tue second
      [10]     // same hour for both
    );
    const mondayScore = scored.find((s) => s.startAt === monday)!.score;
    const tuesdayScore = scored.find((s) => s.startAt === tuesday)!.score;
    expect(mondayScore).toBeGreaterThan(tuesdayScore);
  });
});

// ---------------------------------------------------------------------------
// Test fallback message generation
// ---------------------------------------------------------------------------

function buildFallbackMessage(firstName: string, serviceName: string): string {
  return `Ciao ${firstName}! Hai cancellato il tuo appuntamento per ${serviceName}. Vorresti riprogrammarlo? Contatta la segreteria o rispondi a questo messaggio per scegliere un nuovo orario.`;
}

describe("smart-rebook fallback message", () => {
  it("includes patient first name", () => {
    const msg = buildFallbackMessage("Maria", "Visita medica");
    expect(msg).toContain("Maria");
  });

  it("includes service name", () => {
    const msg = buildFallbackMessage("Luca", "Pulizia denti");
    expect(msg).toContain("Pulizia denti");
  });

  it("starts with Ciao", () => {
    const msg = buildFallbackMessage("Anna", "Servizio");
    expect(msg).toMatch(/^Ciao Anna!/);
  });

  it("asks to reschedule", () => {
    const msg = buildFallbackMessage("Paolo", "Consulenza");
    expect(msg).toContain("riprogrammarlo");
  });
});
