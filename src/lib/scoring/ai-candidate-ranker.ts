/**
 * AI-powered cascade candidate re-ranking using Claude Haiku.
 *
 * Takes the top candidates from the math-based scoring algorithm and
 * re-ranks them using AI analysis of contextual signals that pure math
 * cannot capture: service match, schedule flexibility, acceptance history,
 * time-of-day preference, and visit recency.
 *
 * Falls back to math ranking if AI fails, API key is missing, or times out.
 * Only re-ranks when there are 3+ candidates (below that, math is sufficient).
 */

import type { RankedCandidate } from "@/lib/backfill/find-candidates";

/** Context about the open slot being filled. */
export interface OpenSlotContext {
  readonly scheduledAt: Date;
  readonly serviceName: string;
  readonly providerName: string | null;
  readonly locationName: string | null;
  readonly durationMin: number;
}

/** Tenant-level context for AI analysis. */
export interface TenantContext {
  readonly tenantId: string;
  readonly avgAcceptanceRate?: number;
}

/** Additional patient history for AI analysis. */
export interface CandidateHistory {
  readonly patientId: string;
  readonly offersReceived: number;
  readonly offersAccepted: number;
  readonly offersDeclined: number;
  readonly offersExpired: number;
  readonly lastVisitAt: Date | null;
  readonly preferredTimeOfDay: "morning" | "afternoon" | "evening" | null;
  readonly serviceName: string | null;
  readonly providerName: string | null;
}

/** Result from AI re-ranking. */
export interface AiRerankResult {
  readonly candidates: readonly RankedCandidate[];
  readonly aiReranked: boolean;
  readonly reasoning: readonly string[];
}

/** Single candidate ranking from AI response. */
interface AiRankedEntry {
  readonly patientId: string;
  readonly reasoning: string;
}

const AI_TIMEOUT_MS = 3_000;
const MIN_CANDIDATES_FOR_AI = 3;
const MAX_CANDIDATES_FOR_AI = 10;

/**
 * Re-rank candidates using Claude Haiku for smarter cascade selection.
 *
 * Only activates when:
 * - ANTHROPIC_API_KEY is set
 * - There are 3+ candidates
 * - AI responds within 3 seconds
 *
 * Falls back to original math ranking on any failure.
 */
export async function aiRerankCandidates(
  candidates: readonly RankedCandidate[],
  openSlot: OpenSlotContext,
  tenantContext: TenantContext,
  candidateHistories?: readonly CandidateHistory[]
): Promise<AiRerankResult> {
  // Guard: not enough candidates to benefit from AI
  if (candidates.length < MIN_CANDIDATES_FOR_AI) {
    return {
      candidates,
      aiReranked: false,
      reasoning: ["Fewer than 3 candidates — math ranking sufficient"],
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      candidates,
      aiReranked: false,
      reasoning: ["ANTHROPIC_API_KEY not set — using math ranking"],
    };
  }

  try {
    const topCandidates = candidates.slice(0, MAX_CANDIDATES_FOR_AI);
    const historyMap = buildHistoryMap(candidateHistories ?? []);

    const prompt = buildRerankPrompt(topCandidates, openSlot, tenantContext, historyMap);

    const aiRanking = await callClaudeWithTimeout(apiKey, prompt, AI_TIMEOUT_MS);

    if (!aiRanking) {
      return {
        candidates,
        aiReranked: false,
        reasoning: ["AI call failed or timed out — using math ranking"],
      };
    }

    const reranked = applyAiRanking(topCandidates, aiRanking, candidates);

    return {
      candidates: reranked.orderedCandidates,
      aiReranked: true,
      reasoning: reranked.reasoning,
    };
  } catch (err) {
    console.error("[AI Rerank] Unexpected error, falling back to math:", err);
    return {
      candidates,
      aiReranked: false,
      reasoning: ["AI error — using math ranking"],
    };
  }
}

/** Build a map of patientId -> history for quick lookup. */
function buildHistoryMap(
  histories: readonly CandidateHistory[]
): Map<string, CandidateHistory> {
  const map = new Map<string, CandidateHistory>();
  for (const h of histories) {
    map.set(h.patientId, h);
  }
  return map;
}

/** Build the prompt for Claude to re-rank candidates. */
function buildRerankPrompt(
  candidates: readonly RankedCandidate[],
  openSlot: OpenSlotContext,
  tenantContext: TenantContext,
  historyMap: Map<string, CandidateHistory>
): string {
  const slotHour = openSlot.scheduledAt.getUTCHours();
  const slotTimeOfDay =
    slotHour < 12 ? "morning" : slotHour < 17 ? "afternoon" : "evening";

  const candidateDescriptions = candidates.map((c, i) => {
    const history = historyMap.get(c.patientId);
    const lines = [
      `Candidate ${i + 1} (ID: ${c.patientId}):`,
      `  - Name: ${c.patientName}`,
      `  - Math score: ${c.candidateScore.total}/130`,
      `  - Current appointment: ${c.currentAppointmentAt.toISOString()}`,
      `  - Score breakdown: distance=${c.candidateScore.appointmentDistance}, reliability=${c.candidateScore.reliability}, urgency=${c.candidateScore.urgencyBonus}, responsiveness=${c.candidateScore.responsiveness}`,
    ];

    if (history) {
      const totalOffers = history.offersReceived;
      const acceptRate =
        totalOffers > 0
          ? Math.round((history.offersAccepted / totalOffers) * 100)
          : null;
      lines.push(
        `  - Offer history: ${history.offersReceived} received, ${history.offersAccepted} accepted, ${history.offersDeclined} declined, ${history.offersExpired} expired${acceptRate !== null ? ` (${acceptRate}% accept rate)` : ""}`
      );
      if (history.lastVisitAt) {
        const daysSinceVisit = Math.round(
          (Date.now() - history.lastVisitAt.getTime()) / 86_400_000
        );
        lines.push(`  - Last visit: ${daysSinceVisit} days ago`);
      }
      if (history.preferredTimeOfDay) {
        lines.push(`  - Preferred time: ${history.preferredTimeOfDay}`);
      }
      if (history.serviceName) {
        lines.push(`  - Usual service: ${history.serviceName}`);
      }
      if (history.providerName) {
        lines.push(`  - Preferred provider: ${history.providerName}`);
      }
    }

    return lines.join("\n");
  });

  return `You are a deterministic appointment slot-filling optimizer for a medical clinic. Given the open slot details and candidate patients, re-rank the candidates to maximize the probability that the first-contacted patient accepts the offer.

Open slot details:
- Time: ${openSlot.scheduledAt.toISOString()} (${slotTimeOfDay})
- Service: ${openSlot.serviceName}
- Provider: ${openSlot.providerName ?? "any"}
- Location: ${openSlot.locationName ?? "main"}
- Duration: ${openSlot.durationMin} minutes
${tenantContext.avgAcceptanceRate !== undefined ? `- Clinic avg acceptance rate: ${Math.round(tenantContext.avgAcceptanceRate * 100)}%` : ""}

Candidates (already sorted by math score):
${candidateDescriptions.join("\n\n")}

Re-ranking criteria (in priority order):
1. Acceptance history: Patients who accepted previous offers are strongly preferred over those who declined or never responded
2. Time-of-day match: Patients whose preferred time matches the open slot's time of day
3. Service/provider match: Patients who usually see the same provider or get the same service
4. Visit recency: Patients overdue for a visit (longer since last visit) are more likely to accept
5. Schedule flexibility: Patients with far-out appointments (high distance score) are more flexible

Return ONLY valid JSON: {"ranking": [{"patientId": "<id>", "reasoning": "<1 short sentence>"}]}
Order from most likely to accept to least likely. Include ALL candidates.`;
}

/** Call Claude API with a timeout. Returns parsed ranking or null on failure. */
async function callClaudeWithTimeout(
  apiKey: string,
  prompt: string,
  timeoutMs: number
): Promise<readonly AiRankedEntry[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("[AI Rerank] API returned status:", res.status);
      return null;
    }

    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[AI Rerank] No JSON found in response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      ranking?: readonly AiRankedEntry[];
    };

    if (!Array.isArray(parsed.ranking) || parsed.ranking.length === 0) {
      console.error("[AI Rerank] Invalid ranking format in response");
      return null;
    }

    // Validate each entry has required fields
    const valid = parsed.ranking.every(
      (entry) =>
        typeof entry.patientId === "string" &&
        typeof entry.reasoning === "string"
    );
    if (!valid) {
      console.error("[AI Rerank] Ranking entries missing required fields");
      return null;
    }

    return parsed.ranking;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[AI Rerank] Request timed out after", timeoutMs, "ms");
    } else {
      console.error("[AI Rerank] Fetch error:", err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Apply AI ranking to the candidate list.
 * Candidates not in the AI ranking are appended at the end in their original order.
 */
function applyAiRanking(
  topCandidates: readonly RankedCandidate[],
  aiRanking: readonly AiRankedEntry[],
  allCandidates: readonly RankedCandidate[]
): { orderedCandidates: readonly RankedCandidate[]; reasoning: readonly string[] } {
  const candidateMap = new Map<string, RankedCandidate>();
  for (const c of topCandidates) {
    candidateMap.set(c.patientId, c);
  }

  const orderedTop: RankedCandidate[] = [];
  const reasoning: string[] = [];
  const placedIds = new Set<string>();

  // Place candidates in AI-recommended order
  for (const entry of aiRanking) {
    const candidate = candidateMap.get(entry.patientId);
    if (candidate && !placedIds.has(entry.patientId)) {
      orderedTop.push(candidate);
      reasoning.push(`${candidate.patientName}: ${entry.reasoning}`);
      placedIds.add(entry.patientId);
    }
  }

  // Append any top candidates that AI missed (defensive)
  for (const c of topCandidates) {
    if (!placedIds.has(c.patientId)) {
      orderedTop.push(c);
      reasoning.push(`${c.patientName}: (not ranked by AI, kept original position)`);
      placedIds.add(c.patientId);
    }
  }

  // Append remaining candidates beyond the AI-analyzed slice
  const remaining = allCandidates.filter((c) => !placedIds.has(c.patientId));
  const result = [...orderedTop, ...remaining];

  return { orderedCandidates: result, reasoning };
}
