/**
 * AI-personalized confirmation messages using Claude Haiku.
 *
 * Generates Italian confirmation messages with tone adapted to risk level:
 * - Low risk: friendly, casual
 * - Medium risk: professional, emphasizes importance
 * - High/critical risk: urgent, creates gentle FOMO about slot demand
 *
 * Always in Italian with informal "tu" form.
 * Falls back to static templates on any AI failure.
 */

const AI_TIMEOUT_MS = 3_000;

/** Risk tier derived from numeric score. */
type RiskTier = "low" | "medium" | "high" | "critical";

/** Input for personalized confirmation message generation. */
export interface PersonalizeInput {
  readonly patientName: string;
  readonly serviceName: string;
  readonly providerName: string | null;
  readonly locationName: string | null;
  readonly scheduledAt: Date;
  readonly riskScore: number;
  readonly previousNoShows: number;
  readonly totalAppointments: number;
}

/** Channel determines the character limit for the message. */
export type MessageChannel = "sms" | "whatsapp";

/** Result from the personalizer. */
export interface PersonalizeResult {
  readonly message: string;
  readonly aiGenerated: boolean;
  readonly riskTier: RiskTier;
}

/**
 * Generate a personalized Italian confirmation message.
 *
 * Uses Claude Haiku for AI-powered personalization based on risk level.
 * Falls back to a static template if AI is unavailable or fails.
 */
export async function personalizeConfirmationMessage(
  input: PersonalizeInput,
  channel: MessageChannel = "whatsapp"
): Promise<PersonalizeResult> {
  const riskTier = classifyRisk(input.riskScore);
  const maxChars = channel === "sms" ? 160 : 300;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      message: buildFallbackMessage(input, riskTier, maxChars),
      aiGenerated: false,
      riskTier,
    };
  }

  try {
    const aiMessage = await generateAiMessage(apiKey, input, riskTier, maxChars);

    if (aiMessage) {
      return { message: aiMessage, aiGenerated: true, riskTier };
    }

    return {
      message: buildFallbackMessage(input, riskTier, maxChars),
      aiGenerated: false,
      riskTier,
    };
  } catch (err) {
    console.error("[AI Personalizer] Error, using fallback:", err);
    return {
      message: buildFallbackMessage(input, riskTier, maxChars),
      aiGenerated: false,
      riskTier,
    };
  }
}

/** Classify a numeric risk score into a tier. */
function classifyRisk(score: number): RiskTier {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

/** Build the AI prompt for message generation. */
function buildPrompt(
  input: PersonalizeInput,
  riskTier: RiskTier,
  maxChars: number
): string {
  const dateStr = input.scheduledAt.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = input.scheduledAt.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const noShowInfo =
    input.previousNoShows > 0
      ? `This patient has ${input.previousNoShows} previous no-shows out of ${input.totalAppointments} appointments.`
      : `This patient has a clean record (${input.totalAppointments} appointments, 0 no-shows).`;

  const toneGuide: Record<RiskTier, string> = {
    low: "Friendly and casual. Light and warm. The patient is reliable, so keep it simple and appreciative.",
    medium:
      "Professional but warm. Gently emphasize the importance of confirming. Mention the appointment details clearly.",
    high: "Professional and firm. Emphasize that the slot is valuable and in demand. Create gentle urgency without being aggressive. Mention other patients are waiting for available slots.",
    critical:
      "Urgent and direct. This slot is highly sought after. Create FOMO by mentioning that the slot could be offered to other patients if not confirmed. Be respectful but make the urgency clear.",
  };

  return `Generate a confirmation message for a medical appointment in Italian. Use informal "tu" form (not "Lei").

Patient: ${input.patientName}
Service: ${input.serviceName}
${input.providerName ? `Provider: ${input.providerName}` : ""}
${input.locationName ? `Location: ${input.locationName}` : ""}
Date: ${dateStr}
Time: ${timeStr}
Risk level: ${riskTier}
${noShowInfo}

Tone: ${toneGuide[riskTier]}

Rules:
- MUST be in Italian with informal "tu" form
- MUST include date and time of the appointment
- MUST end with instructions to reply SI to confirm or NO to cancel
- Max ${maxChars} characters (STRICT limit, count carefully)
- No emojis for SMS (under 160 chars), emojis OK for WhatsApp (under 300 chars)
- Do NOT include greetings like "Ciao" for SMS (wastes characters)

Return ONLY the message text, nothing else. No quotes, no explanation.`;
}

/** Call Claude API with timeout. Returns the message text or null. */
async function generateAiMessage(
  apiKey: string,
  input: PersonalizeInput,
  riskTier: RiskTier,
  maxChars: number
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const prompt = buildPrompt(input, riskTier, maxChars);

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
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("[AI Personalizer] API returned status:", res.status);
      return null;
    }

    const data = await res.json();
    const text: string = (data.content?.[0]?.text ?? "").trim();

    if (!text || text.length === 0) {
      console.error("[AI Personalizer] Empty response from API");
      return null;
    }

    // Enforce character limit — if AI exceeded it, truncate gracefully
    if (text.length > maxChars) {
      console.warn(
        `[AI Personalizer] Message exceeded ${maxChars} chars (${text.length}), truncating`
      );
      // Try to truncate at the last sentence boundary within limit
      const truncated = truncateAtBoundary(text, maxChars);
      return truncated;
    }

    return text;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[AI Personalizer] Request timed out after", AI_TIMEOUT_MS, "ms");
    } else {
      console.error("[AI Personalizer] Fetch error:", err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Truncate text at the nearest sentence boundary within maxChars. */
function truncateAtBoundary(text: string, maxChars: number): string {
  const trimmed = text.slice(0, maxChars);
  const lastPeriod = trimmed.lastIndexOf(".");
  const lastExclaim = trimmed.lastIndexOf("!");
  const lastQuestion = trimmed.lastIndexOf("?");
  const boundary = Math.max(lastPeriod, lastExclaim, lastQuestion);

  if (boundary > maxChars * 0.5) {
    return trimmed.slice(0, boundary + 1);
  }

  // No good boundary — hard truncate
  return trimmed;
}

/** Build a static fallback message when AI is unavailable. */
export function buildFallbackMessage(
  input: PersonalizeInput,
  riskTier: RiskTier,
  maxChars: number
): string {
  const dateStr = input.scheduledAt.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = input.scheduledAt.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const provider = input.providerName ? ` con ${input.providerName}` : "";

  if (maxChars <= 160) {
    // SMS: ultra-concise
    switch (riskTier) {
      case "low":
        return `Ciao ${input.patientName}! Appuntamento ${input.serviceName} il ${dateStr} ore ${timeStr}. Confermi? Rispondi SI o NO.`;
      case "medium":
        return `${input.patientName}, ricorda il tuo appuntamento${provider}: ${dateStr} ore ${timeStr}. Rispondi SI per confermare o NO per cancellare.`;
      case "high":
      case "critical":
        return `${input.patientName}, il tuo posto${provider} il ${dateStr} ore ${timeStr} è richiesto. Conferma con SI o sarà offerto ad altri.`;
    }
  }

  // WhatsApp: longer, richer
  switch (riskTier) {
    case "low":
      return [
        `Ciao ${input.patientName}!`,
        `Ti ricordiamo il tuo appuntamento:`,
        `${input.serviceName}${provider}`,
        `${dateStr} alle ${timeStr}`,
        `Rispondi *SI* per confermare o *NO* per cancellare.`,
      ].join("\n");
    case "medium":
      return [
        `Ciao ${input.patientName},`,
        `ti ricordiamo il tuo appuntamento:`,
        `${input.serviceName}${provider}`,
        `${dateStr} alle ${timeStr}`,
        `Rispondi *SI* per confermare o *NO* per cancellare.`,
      ].join("\n");
    case "high":
    case "critical":
      return [
        `${input.patientName}, il tuo appuntamento si avvicina:`,
        `${input.serviceName}${provider}`,
        `${dateStr} alle ${timeStr}`,
        `Questo posto è molto richiesto. Conferma con *SI* o il posto sarà offerto ad altri pazienti.`,
      ].join("\n");
  }
}
