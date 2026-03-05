// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Inline the pure fallback logic to test without Supabase/Anthropic
// ---------------------------------------------------------------------------

function buildFallbackBriefing(
  data: {
    todayCount: number;
    pendingConfirmations: number;
    highRiskCount: number;
    activeOfferCount: number;
    yesterdayNoShows: number;
    yesterdayRecoveries: number;
    yesterdayRevenueSaved: number;
  },
  date: string
): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  const dateStr = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const lines: string[] = [
    `Buongiorno! Oggi, ${dateStr}, ci sono ${data.todayCount} appuntamenti in agenda.`,
  ];
  if (data.pendingConfirmations > 0) {
    lines.push(`${data.pendingConfirmations} appuntamenti sono ancora in attesa di conferma.`);
  }
  if (data.highRiskCount > 0) {
    lines.push(`Attenzione: ${data.highRiskCount} appuntamenti ad alto rischio richiedono monitoraggio.`);
  }
  if (data.activeOfferCount > 0) {
    lines.push(`Cascade attivo: ${data.activeOfferCount} offerte in corso.`);
  }
  if (data.yesterdayNoShows > 0 || data.yesterdayRecoveries > 0) {
    lines.push(
      `Ieri: ${data.yesterdayNoShows} no-show, ${data.yesterdayRecoveries} slot recuperati (€${data.yesterdayRevenueSaved} ricuperati).`
    );
  }
  return lines.join(" ");
}

describe("morning briefing fallback", () => {
  it("includes today count in the greeting", () => {
    const text = buildFallbackBriefing(
      { todayCount: 12, pendingConfirmations: 0, highRiskCount: 0, activeOfferCount: 0, yesterdayNoShows: 0, yesterdayRecoveries: 0, yesterdayRevenueSaved: 0 },
      "2026-03-04"
    );
    expect(text).toContain("12 appuntamenti");
  });

  it("mentions pending confirmations when > 0", () => {
    const text = buildFallbackBriefing(
      { todayCount: 5, pendingConfirmations: 3, highRiskCount: 0, activeOfferCount: 0, yesterdayNoShows: 0, yesterdayRecoveries: 0, yesterdayRevenueSaved: 0 },
      "2026-03-04"
    );
    expect(text).toContain("3 appuntamenti sono ancora in attesa di conferma");
  });

  it("omits pending confirmation sentence when pendingConfirmations is 0", () => {
    const text = buildFallbackBriefing(
      { todayCount: 5, pendingConfirmations: 0, highRiskCount: 0, activeOfferCount: 0, yesterdayNoShows: 0, yesterdayRecoveries: 0, yesterdayRevenueSaved: 0 },
      "2026-03-04"
    );
    expect(text).not.toContain("in attesa di conferma");
  });

  it("mentions high risk count when > 0", () => {
    const text = buildFallbackBriefing(
      { todayCount: 8, pendingConfirmations: 0, highRiskCount: 2, activeOfferCount: 0, yesterdayNoShows: 0, yesterdayRecoveries: 0, yesterdayRevenueSaved: 0 },
      "2026-03-04"
    );
    expect(text).toContain("2 appuntamenti ad alto rischio");
  });

  it("mentions cascade when activeOfferCount > 0", () => {
    const text = buildFallbackBriefing(
      { todayCount: 5, pendingConfirmations: 0, highRiskCount: 0, activeOfferCount: 4, yesterdayNoShows: 0, yesterdayRecoveries: 0, yesterdayRevenueSaved: 0 },
      "2026-03-04"
    );
    expect(text).toContain("Cascade attivo: 4 offerte");
  });

  it("mentions yesterday stats when noShows > 0", () => {
    const text = buildFallbackBriefing(
      { todayCount: 5, pendingConfirmations: 0, highRiskCount: 0, activeOfferCount: 0, yesterdayNoShows: 2, yesterdayRecoveries: 1, yesterdayRevenueSaved: 80 },
      "2026-03-04"
    );
    expect(text).toContain("Ieri: 2 no-show");
    expect(text).toContain("1 slot recuperati");
    expect(text).toContain("€80");
  });

  it("omits yesterday stats when both are 0", () => {
    const text = buildFallbackBriefing(
      { todayCount: 5, pendingConfirmations: 0, highRiskCount: 0, activeOfferCount: 0, yesterdayNoShows: 0, yesterdayRecoveries: 0, yesterdayRevenueSaved: 0 },
      "2026-03-04"
    );
    expect(text).not.toContain("Ieri:");
  });

  it("starts with Buongiorno", () => {
    const text = buildFallbackBriefing(
      { todayCount: 1, pendingConfirmations: 0, highRiskCount: 0, activeOfferCount: 0, yesterdayNoShows: 0, yesterdayRecoveries: 0, yesterdayRevenueSaved: 0 },
      "2026-03-04"
    );
    expect(text).toMatch(/^Buongiorno!/);
  });
});
