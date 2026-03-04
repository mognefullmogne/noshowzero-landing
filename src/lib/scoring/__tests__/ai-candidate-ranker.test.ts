import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  aiRerankCandidates,
  type OpenSlotContext,
  type TenantContext,
  type CandidateHistory,
} from "@/lib/scoring/ai-candidate-ranker";
import type { RankedCandidate } from "@/lib/backfill/find-candidates";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCandidate(overrides: Partial<RankedCandidate> = {}): RankedCandidate {
  return {
    candidateAppointmentId: `appt-${overrides.patientId ?? "default"}`,
    patientId: "pat-default",
    patientName: "Test Patient",
    patientPhone: "+391234567890",
    patientEmail: null,
    preferredChannel: "whatsapp",
    candidateScore: {
      total: 80,
      appointmentDistance: 45,
      reliability: 30,
      urgencyBonus: 5,
      responsiveness: 0,
    },
    currentAppointmentAt: new Date("2026-05-15T10:00:00Z"),
    ...overrides,
  };
}

const OPEN_SLOT: OpenSlotContext = {
  scheduledAt: new Date("2026-04-01T09:00:00Z"),
  serviceName: "Visita Generale",
  providerName: "Dr. Rossi",
  locationName: "Studio Roma",
  durationMin: 30,
};

const TENANT: TenantContext = {
  tenantId: "tenant-001",
  avgAcceptanceRate: 0.65,
};

function makeCandidates(count: number): RankedCandidate[] {
  return Array.from({ length: count }, (_, i) =>
    makeCandidate({
      patientId: `pat-${i + 1}`,
      patientName: `Patient ${i + 1}`,
      candidateScore: {
        total: 100 - i * 10,
        appointmentDistance: 60 - i * 5,
        reliability: 40 - i * 5,
        urgencyBonus: 0,
        responsiveness: 0,
      },
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("aiRerankCandidates", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // -------------------------------------------------------------------------
  // 1. Returns original order when fewer than 3 candidates
  // -------------------------------------------------------------------------
  it("returns original order when fewer than 3 candidates", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const candidates = makeCandidates(2);

    const result = await aiRerankCandidates(candidates, OPEN_SLOT, TENANT);

    expect(result.aiReranked).toBe(false);
    expect(result.candidates).toEqual(candidates);
    expect(result.reasoning[0]).toContain("Fewer than 3");
  });

  // -------------------------------------------------------------------------
  // 2. Returns original order when API key is missing
  // -------------------------------------------------------------------------
  it("returns original order when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const candidates = makeCandidates(5);

    const result = await aiRerankCandidates(candidates, OPEN_SLOT, TENANT);

    expect(result.aiReranked).toBe(false);
    expect(result.candidates).toEqual(candidates);
    expect(result.reasoning[0]).toContain("ANTHROPIC_API_KEY not set");
  });

  // -------------------------------------------------------------------------
  // 3. Falls back on API error
  // -------------------------------------------------------------------------
  it("falls back to math ranking on API error", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const candidates = makeCandidates(4);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 })
    );

    const result = await aiRerankCandidates(candidates, OPEN_SLOT, TENANT);

    expect(result.aiReranked).toBe(false);
    expect(result.candidates).toEqual(candidates);
  });

  // -------------------------------------------------------------------------
  // 4. Falls back on timeout (AbortError)
  // -------------------------------------------------------------------------
  it("falls back to math ranking on fetch abort/timeout", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const candidates = makeCandidates(4);

    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" })
    );

    const result = await aiRerankCandidates(candidates, OPEN_SLOT, TENANT);

    expect(result.aiReranked).toBe(false);
    expect(result.candidates).toEqual(candidates);
  });

  // -------------------------------------------------------------------------
  // 5. Falls back on invalid JSON response
  // -------------------------------------------------------------------------
  it("falls back to math ranking when AI returns invalid JSON", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const candidates = makeCandidates(4);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "I cannot rank these candidates." }],
        }),
        { status: 200 }
      )
    );

    const result = await aiRerankCandidates(candidates, OPEN_SLOT, TENANT);

    expect(result.aiReranked).toBe(false);
    expect(result.candidates).toEqual(candidates);
  });

  // -------------------------------------------------------------------------
  // 6. Successfully re-ranks candidates from AI response
  // -------------------------------------------------------------------------
  it("re-ranks candidates based on AI response", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const candidates = makeCandidates(4);

    // AI reverses the order
    const aiResponse = {
      ranking: [
        { patientId: "pat-4", reasoning: "Best acceptance history" },
        { patientId: "pat-3", reasoning: "Time-of-day match" },
        { patientId: "pat-1", reasoning: "High math score but low acceptance" },
        { patientId: "pat-2", reasoning: "Average fit" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: JSON.stringify(aiResponse) }],
        }),
        { status: 200 }
      )
    );

    const result = await aiRerankCandidates(candidates, OPEN_SLOT, TENANT);

    expect(result.aiReranked).toBe(true);
    expect(result.candidates[0].patientId).toBe("pat-4");
    expect(result.candidates[1].patientId).toBe("pat-3");
    expect(result.candidates[2].patientId).toBe("pat-1");
    expect(result.candidates[3].patientId).toBe("pat-2");
    expect(result.reasoning).toHaveLength(4);
    expect(result.reasoning[0]).toContain("Best acceptance history");
  });

  // -------------------------------------------------------------------------
  // 7. Appends candidates that AI missed
  // -------------------------------------------------------------------------
  it("appends candidates not mentioned by AI at the end", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const candidates = makeCandidates(5);

    // AI only ranks 3 of 5
    const aiResponse = {
      ranking: [
        { patientId: "pat-3", reasoning: "Best fit" },
        { patientId: "pat-1", reasoning: "Good score" },
        { patientId: "pat-5", reasoning: "Overdue visit" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: JSON.stringify(aiResponse) }],
        }),
        { status: 200 }
      )
    );

    const result = await aiRerankCandidates(candidates, OPEN_SLOT, TENANT);

    expect(result.aiReranked).toBe(true);
    // First 3 from AI
    expect(result.candidates[0].patientId).toBe("pat-3");
    expect(result.candidates[1].patientId).toBe("pat-1");
    expect(result.candidates[2].patientId).toBe("pat-5");
    // Remaining 2 appended (pat-2 and pat-4 in their original relative order)
    expect(result.candidates[3].patientId).toBe("pat-2");
    expect(result.candidates[4].patientId).toBe("pat-4");
  });

  // -------------------------------------------------------------------------
  // 8. Includes candidate history in the prompt
  // -------------------------------------------------------------------------
  it("includes candidate history data in the AI prompt", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const candidates = makeCandidates(3);

    const histories: CandidateHistory[] = [
      {
        patientId: "pat-1",
        offersReceived: 5,
        offersAccepted: 4,
        offersDeclined: 1,
        offersExpired: 0,
        lastVisitAt: new Date("2026-03-01T10:00:00Z"),
        preferredTimeOfDay: "morning",
        serviceName: "Visita Generale",
        providerName: "Dr. Rossi",
      },
    ];

    const aiResponse = {
      ranking: [
        { patientId: "pat-1", reasoning: "History match" },
        { patientId: "pat-2", reasoning: "Decent" },
        { patientId: "pat-3", reasoning: "Low priority" },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: JSON.stringify(aiResponse) }],
        }),
        { status: 200 }
      )
    );

    await aiRerankCandidates(candidates, OPEN_SLOT, TENANT, histories);

    // Verify the prompt includes history data
    const callBody = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    const prompt = callBody.messages[0].content as string;
    expect(prompt).toContain("Offer history: 5 received");
    expect(prompt).toContain("80% accept rate");
    expect(prompt).toContain("Preferred time: morning");
    expect(prompt).toContain("Usual service: Visita Generale");
  });

  // -------------------------------------------------------------------------
  // 9. Uses correct Claude model and temperature
  // -------------------------------------------------------------------------
  it("calls Claude with correct model and temperature=0", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const candidates = makeCandidates(3);

    const aiResponse = {
      ranking: candidates.map((c, i) => ({
        patientId: c.patientId,
        reasoning: `Rank ${i + 1}`,
      })),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: JSON.stringify(aiResponse) }],
        }),
        { status: 200 }
      )
    );

    await aiRerankCandidates(candidates, OPEN_SLOT, TENANT);

    const callBody = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    expect(callBody.model).toBe("claude-haiku-4-5-20251001");
    expect(callBody.temperature).toBe(0);
    expect(callBody.max_tokens).toBe(512);
  });

  // -------------------------------------------------------------------------
  // 10. Falls back when ranking entries are malformed
  // -------------------------------------------------------------------------
  it("falls back when AI returns ranking with missing fields", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const candidates = makeCandidates(3);

    const aiResponse = {
      ranking: [
        { patientId: "pat-1" }, // missing reasoning
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: JSON.stringify(aiResponse) }],
        }),
        { status: 200 }
      )
    );

    const result = await aiRerankCandidates(candidates, OPEN_SLOT, TENANT);

    expect(result.aiReranked).toBe(false);
    expect(result.candidates).toEqual(candidates);
  });
});
