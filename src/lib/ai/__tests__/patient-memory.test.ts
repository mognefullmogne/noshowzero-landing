import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatMemoryAsContext } from "../patient-memory";
import type { MemoryFact } from "../patient-memory";

// ---------------------------------------------------------------------------
// formatMemoryAsContext — pure function, no DB/AI needed
// ---------------------------------------------------------------------------

describe("formatMemoryAsContext", () => {
  it("returns empty string when no facts", () => {
    expect(formatMemoryAsContext([])).toBe("");
  });

  it("returns preferred times when present", () => {
    const facts: MemoryFact[] = [
      { extractedAt: "2026-01-01T00:00:00Z", preferredTimes: ["mattina"] },
    ];
    const result = formatMemoryAsContext(facts);
    expect(result).toContain("mattina");
    expect(result).toContain("Preferisce");
  });

  it("returns preferred days when present", () => {
    const facts: MemoryFact[] = [
      { extractedAt: "2026-01-01T00:00:00Z", preferredDays: ["lunedi", "martedi"] },
    ];
    const result = formatMemoryAsContext(facts);
    expect(result).toContain("lunedi");
    expect(result).toContain("Giorni preferiti");
  });

  it("includes preferred provider", () => {
    const facts: MemoryFact[] = [
      { extractedAt: "2026-01-01T00:00:00Z", preferredProvider: "Dr. Rossi" },
    ];
    const result = formatMemoryAsContext(facts);
    expect(result).toContain("Dr. Rossi");
  });

  it("includes language and style", () => {
    const facts: MemoryFact[] = [
      {
        extractedAt: "2026-01-01T00:00:00Z",
        language: "it-informal",
        communicationStyle: "informal",
      },
    ];
    const result = formatMemoryAsContext(facts);
    expect(result).toContain("it-informal");
    expect(result).toContain("informal");
  });

  it("includes notes", () => {
    const facts: MemoryFact[] = [
      { extractedAt: "2026-01-01T00:00:00Z", notes: ["cancella spesso per lavoro"] },
    ];
    const result = formatMemoryAsContext(facts);
    expect(result).toContain("cancella spesso per lavoro");
  });

  it("aggregates across multiple facts — deduplicates times", () => {
    const facts: MemoryFact[] = [
      { extractedAt: "2026-01-01T00:00:00Z", preferredTimes: ["mattina"] },
      { extractedAt: "2026-01-02T00:00:00Z", preferredTimes: ["mattina", "pomeriggio"] },
    ];
    const result = formatMemoryAsContext(facts);
    // "mattina" should appear once due to Set deduplication
    const matches = result.match(/mattina/g) ?? [];
    expect(matches.length).toBe(1);
    expect(result).toContain("pomeriggio");
  });

  it("uses only the most recent provider (first in array = newest)", () => {
    const facts: MemoryFact[] = [
      { extractedAt: "2026-01-02T00:00:00Z", preferredProvider: "Dr. Bianchi" },
      { extractedAt: "2026-01-01T00:00:00Z", preferredProvider: "Dr. Rossi" },
    ];
    const result = formatMemoryAsContext(facts);
    expect(result).toContain("Dr. Bianchi");
    // Dr. Rossi should not appear since only the first (newest) provider is used
    expect(result).not.toContain("Dr. Rossi");
  });

  it("limits preferred times to 3 entries", () => {
    const facts: MemoryFact[] = [
      {
        extractedAt: "2026-01-01T00:00:00Z",
        preferredTimes: ["mattina", "09:00", "10:00", "11:00", "pomeriggio"],
      },
    ];
    const result = formatMemoryAsContext(facts);
    // Should contain at most 3 times
    const timePart = result.split("Giorni preferiti")[0];
    const commas = (timePart.match(/,/g) ?? []).length;
    expect(commas).toBeLessThanOrEqual(2); // 3 items = at most 2 commas
  });

  it("handles facts with no content gracefully", () => {
    const facts: MemoryFact[] = [
      { extractedAt: "2026-01-01T00:00:00Z" },
    ];
    // Should return empty string since nothing was extracted
    const result = formatMemoryAsContext(facts);
    expect(result).toBe("");
  });

  it("builds comma-separated context string", () => {
    const facts: MemoryFact[] = [
      {
        extractedAt: "2026-01-01T00:00:00Z",
        preferredTimes: ["mattina"],
        language: "it-informal",
        notes: ["lavora di pomeriggio"],
      },
    ];
    const result = formatMemoryAsContext(facts);
    // All parts should be joined with ", "
    expect(result).toMatch(/,/);
    expect(result).toContain("mattina");
    expect(result).toContain("it-informal");
    expect(result).toContain("lavora di pomeriggio");
  });
});
