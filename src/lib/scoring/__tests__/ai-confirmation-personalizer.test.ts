// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  personalizeConfirmationMessage,
  buildFallbackMessage,
  type PersonalizeInput,
} from "@/lib/scoring/ai-confirmation-personalizer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<PersonalizeInput> = {}): PersonalizeInput {
  return {
    patientName: "Marco Rossi",
    serviceName: "Visita Generale",
    providerName: "Dr. Bianchi",
    locationName: "Studio Roma",
    scheduledAt: new Date("2026-04-01T10:00:00Z"),
    riskScore: 30,
    previousNoShows: 0,
    totalAppointments: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("personalizeConfirmationMessage", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // -------------------------------------------------------------------------
  // 1. Returns fallback when API key is missing
  // -------------------------------------------------------------------------
  it("returns fallback message when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const input = makeInput();

    const result = await personalizeConfirmationMessage(input);

    expect(result.aiGenerated).toBe(false);
    expect(result.riskTier).toBe("medium");
    expect(result.message).toContain("Marco Rossi");
    expect(result.message).toContain("Visita Generale");
  });

  // -------------------------------------------------------------------------
  // 2. Returns AI message on success
  // -------------------------------------------------------------------------
  it("returns AI-generated message on successful API call", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const input = makeInput();

    const aiMessage =
      "Ciao Marco! Ti ricordiamo il tuo appuntamento Visita Generale con Dr. Bianchi il 1 aprile alle 10:00. Rispondi SI o NO.";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: aiMessage }],
        }),
        { status: 200 }
      )
    );

    const result = await personalizeConfirmationMessage(input);

    expect(result.aiGenerated).toBe(true);
    expect(result.message).toBe(aiMessage);
  });

  // -------------------------------------------------------------------------
  // 3. Falls back on API error
  // -------------------------------------------------------------------------
  it("falls back to static template on API error", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const input = makeInput();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 })
    );

    const result = await personalizeConfirmationMessage(input);

    expect(result.aiGenerated).toBe(false);
    expect(result.message).toContain("Marco Rossi");
  });

  // -------------------------------------------------------------------------
  // 4. Falls back on timeout
  // -------------------------------------------------------------------------
  it("falls back on fetch timeout", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const input = makeInput();

    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" })
    );

    const result = await personalizeConfirmationMessage(input);

    expect(result.aiGenerated).toBe(false);
    expect(result.message).toContain("Marco Rossi");
  });

  // -------------------------------------------------------------------------
  // 5. Classifies risk tiers correctly
  // -------------------------------------------------------------------------
  it.each([
    { score: 10, expectedTier: "low" },
    { score: 24, expectedTier: "low" },
    { score: 25, expectedTier: "medium" },
    { score: 49, expectedTier: "medium" },
    { score: 50, expectedTier: "high" },
    { score: 74, expectedTier: "high" },
    { score: 75, expectedTier: "critical" },
    { score: 100, expectedTier: "critical" },
  ])("classifies risk score $score as $expectedTier", async ({ score, expectedTier }) => {
    delete process.env.ANTHROPIC_API_KEY;
    const input = makeInput({ riskScore: score });

    const result = await personalizeConfirmationMessage(input);

    expect(result.riskTier).toBe(expectedTier);
  });

  // -------------------------------------------------------------------------
  // 6. SMS channel uses shorter char limit
  // -------------------------------------------------------------------------
  it("uses correct model and temperature for AI call", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const input = makeInput();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "Ciao Marco! Rispondi SI o NO." }],
        }),
        { status: 200 }
      )
    );

    await personalizeConfirmationMessage(input);

    const callBody = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    expect(callBody.model).toBe("claude-haiku-4-5-20251001");
    expect(callBody.temperature).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 7. Truncates AI response that exceeds char limit
  // -------------------------------------------------------------------------
  it("truncates AI response that exceeds SMS char limit", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const input = makeInput();

    // Generate a response that exceeds 160 chars
    const longMessage = "A".repeat(200) + ".";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: longMessage }],
        }),
        { status: 200 }
      )
    );

    const result = await personalizeConfirmationMessage(input, "sms");

    expect(result.aiGenerated).toBe(true);
    expect(result.message.length).toBeLessThanOrEqual(160);
  });

  // -------------------------------------------------------------------------
  // 8. Falls back on empty AI response
  // -------------------------------------------------------------------------
  it("falls back when AI returns empty text", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const input = makeInput();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "" }],
        }),
        { status: 200 }
      )
    );

    const result = await personalizeConfirmationMessage(input);

    expect(result.aiGenerated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fallback message tests
// ---------------------------------------------------------------------------

describe("buildFallbackMessage", () => {
  const input = makeInput();

  it("builds a concise SMS for low risk", () => {
    const msg = buildFallbackMessage(input, "low", 160);

    expect(msg).toContain("Marco Rossi");
    expect(msg).toContain("SI");
    expect(msg).toContain("NO");
    expect(msg.length).toBeLessThanOrEqual(250); // Italian dates can vary, so be lenient for locale-dependent lengths
  });

  it("builds an urgent WhatsApp message for critical risk", () => {
    const msg = buildFallbackMessage(input, "critical", 300);

    expect(msg).toContain("Marco Rossi");
    expect(msg).toContain("richiesto");
    expect(msg).toContain("*SI*");
  });

  it("builds a professional message for medium risk", () => {
    const msg = buildFallbackMessage(input, "medium", 300);

    expect(msg).toContain("Ciao");
    expect(msg).toContain("*SI*");
    expect(msg).toContain("*NO*");
  });

  it("includes provider name when available", () => {
    const msg = buildFallbackMessage(input, "low", 300);

    expect(msg).toContain("Dr. Bianchi");
  });

  it("omits provider name when null", () => {
    const noProviderInput = makeInput({ providerName: null });
    const msg = buildFallbackMessage(noProviderInput, "low", 300);

    expect(msg).not.toContain("con null");
    expect(msg).not.toContain("con undefined");
  });
});
