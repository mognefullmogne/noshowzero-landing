/**
 * AI-enhanced risk scoring using Claude.
 * Falls back to deterministic scoring on any failure.
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { score: deterministic.score, reasoning: deterministic.reasoning, aiGenerated: false };
  }

  try {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const leadDays = Math.round(
      Math.max(0, input.scheduledAt.getTime() - input.createdAt.getTime()) / 86_400_000
    );

    const prompt = `You are a no-show risk scoring engine. Analyze this appointment and return a JSON object with "score" (0-100 integer) and "reasoning" (1-2 sentences).

Patient history:
- Total appointments: ${input.totalAppointments}
- No-shows: ${input.noShows}
- Cancellations: ${input.cancellations}
- Confirmations: ${input.confirmations}

Appointment details:
- Day: ${dayNames[input.scheduledAt.getUTCDay()]}
- Hour: ${input.scheduledAt.getUTCHours()}:00
- Lead time: ${leadDays} days
${input.serviceCode ? `- Service: ${input.serviceCode}` : ""}

Score factors: history weight 40%, day-of-week 15%, time-of-day 15%, lead-time 30%.
Return ONLY valid JSON.`;

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
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return { score: deterministic.score, reasoning: deterministic.reasoning, aiGenerated: false };
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { score: deterministic.score, reasoning: deterministic.reasoning, aiGenerated: false };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const rawScore = Number(parsed.score);
    if (Number.isNaN(rawScore)) {
      return { score: deterministic.score, reasoning: deterministic.reasoning, aiGenerated: false };
    }
    const aiScore = Math.min(100, Math.max(0, Math.round(rawScore)));
    const aiReasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : deterministic.reasoning;

    return { score: aiScore, reasoning: aiReasoning, aiGenerated: true };
  } catch {
    return { score: deterministic.score, reasoning: deterministic.reasoning, aiGenerated: false };
  }
}
