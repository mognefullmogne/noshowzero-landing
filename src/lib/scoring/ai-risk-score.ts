/**
 * AI-enhanced risk scoring using Claude.
 * Falls back to deterministic scoring on any failure.
 *
 * Key: Uses temperature=0 for consistent results — same inputs always produce
 * the same score. For new patients with no history, skips AI entirely and
 * returns the deterministic score (no point asking AI with zero data).
 */

import { computeRiskScore } from "./risk-score";

interface AiRiskInput {
  readonly totalAppointments: number;
  readonly noShows: number;
  readonly cancellations: number;
  readonly confirmations: number;
  readonly scheduledAt: Date;
  readonly createdAt: Date;
  readonly serviceCode?: string;
}

interface AiRiskResult {
  readonly score: number;
  readonly reasoning: string;
  readonly aiGenerated: boolean;
}

export async function computeAiRiskScore(input: AiRiskInput): Promise<AiRiskResult> {
  // Always compute deterministic as fallback
  const deterministic = computeRiskScore({
    totalAppointments: input.totalAppointments,
    noShows: input.noShows,
    scheduledAt: input.scheduledAt,
    createdAt: input.createdAt,
  });

  // No point calling AI for patients with insufficient history — the deterministic
  // score is already accurate and won't benefit from AI interpretation
  if (input.totalAppointments < 3) {
    return { score: deterministic.score, reasoning: deterministic.reasoning, aiGenerated: false };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { score: deterministic.score, reasoning: deterministic.reasoning, aiGenerated: false };
  }

  try {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const leadDays = Math.round(
      Math.max(0, input.scheduledAt.getTime() - input.createdAt.getTime()) / 86_400_000
    );

    // Clamp inputs to prevent dirty data from inflating scores
    const safeNoShows = Math.min(input.noShows, input.totalAppointments);
    const safeCancellations = Math.min(input.cancellations, input.totalAppointments - safeNoShows);
    const safeConfirmations = Math.min(input.confirmations, input.totalAppointments - safeNoShows - safeCancellations);

    const noShowRate = Math.round((safeNoShows / input.totalAppointments) * 100);
    const confirmRate = Math.round((safeConfirmations / input.totalAppointments) * 100);

    const prompt = `You are a deterministic no-show risk scoring engine. Given the exact data below, compute a precise score and short reasoning. Your score must be reproducible — the same inputs must always produce the same output.

Patient history:
- Total appointments: ${input.totalAppointments}
- No-shows: ${safeNoShows} (${noShowRate}%)
- Cancellations: ${safeCancellations}
- Confirmations: ${safeConfirmations} (${confirmRate}%)

Appointment details:
- Day: ${dayNames[input.scheduledAt.getUTCDay()]}
- Hour: ${input.scheduledAt.getUTCHours()}:00
- Lead time: ${leadDays} days
${input.serviceCode ? `- Service: ${input.serviceCode}` : ""}

Scoring formula (apply exactly):
- History component (0-40): (noShows / totalAppointments) * 40 = ${Math.round((safeNoShows / input.totalAppointments) * 40)}
- Day-of-week (0-15): Monday=15, Friday=10, Weekend=5, Other=0
- Time-of-day (0-15): Before 9AM=15, After 5PM=10, Other=0
- Lead-time (0-30): >21d=30, 14-21d=20, 7-14d=10, <7d=5
- AI adjustment (-5 to +5): Based on confirmation rate and cancellation patterns

Sum all components and clamp to 0-100.

Return ONLY valid JSON: {"score": <integer 0-100>, "reasoning": "<1-2 sentences>"}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return { score: deterministic.score, reasoning: deterministic.reasoning, aiGenerated: false };
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return { score: deterministic.score, reasoning: deterministic.reasoning, aiGenerated: false };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const rawScore = Number(parsed.score);
    if (Number.isNaN(rawScore)) {
      return { score: deterministic.score, reasoning: deterministic.reasoning, aiGenerated: false };
    }
    const aiScore = Math.min(100, Math.max(0, Math.round(rawScore)));
    const aiReasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 500) : deterministic.reasoning;

    return { score: aiScore, reasoning: aiReasoning, aiGenerated: true };
  } catch {
    return { score: deterministic.score, reasoning: deterministic.reasoning, aiGenerated: false };
  }
}
