/**
 * Regex-based intent classifier for patient messages.
 * Returns high confidence for exact matches, medium for partial, 0.0 for unknown (AI fallback).
 */

import type { MessageIntent } from "@/lib/types";

interface IntentResult {
  readonly intent: MessageIntent;
  readonly confidence: number;
  readonly source: "regex";
}

const PATTERNS: readonly { intent: MessageIntent; exact: RegExp; partial: RegExp }[] = [
  {
    intent: "confirm",
    exact: /^(s[iì]|yes|ok|confermo|conferma)$/i,
    partial: /\b(s[iì]|yes|ok|conferm[oa]|accett[oa])\b/i,
  },
  {
    intent: "cancel",
    exact: /^(no|annull[oa]|cancell[oa]|disdic[oa])$/i,
    partial: /\b(no|annull|cancel|disdic|non\s+veng[oa]|non\s+riesc[oa]|non\s+posso|non\s+ce\s+la\s+faccio|non\s+vengo\s+pi[uù]|devo\s+disdire|devo\s+cancellare|non\s+posso\s+venire|non\s+riesco\s+a\s+venire)\b/i,
  },
  {
    intent: "accept_offer",
    exact: /^(accett[oa]|prendo|vado|s[iì])$/i,
    partial: /\b(accett[oa]|prend[oa]|vad[oa]|piacere)\b/i,
  },
  {
    intent: "decline_offer",
    exact: /^(rifiut[oa]|no|passo)$/i,
    partial: /\b(rifiut|non\s+mi\s+interessa|passo)\b/i,
  },
  {
    intent: "slot_select",
    exact: /^[123]$/,
    partial: /\b(opzione\s*[123]|scelt[oa]\s*[123]|prefer\w*\s*[123])\b/i,
  },
  {
    intent: "book_appointment",
    exact: /^(prenotare|prenota|prenotazione|appuntamento)$/i,
    partial: /\b(prenot[aeio]|appuntamento|fissare|vorrei\s+(un\s+)?appuntamento|prenotare\s+una?\s+visita|nuov[oa]\s+visita)\b/i,
  },
  {
    intent: "join_waitlist",
    exact: /^(lista|lista\s+d[ie]?\s*attesa|attesa)$/i,
    partial: /\b(lista\s*d[ie']?\s*attesa|mett[aeio]\w*\s+in\s+lista|lista\s+attesa)\b/i,
  },
];

export function classifyIntent(text: string): IntentResult {
  const trimmed = text.trim();

  for (const { intent, exact, partial } of PATTERNS) {
    if (exact.test(trimmed)) {
      return { intent, confidence: 1.0, source: "regex" };
    }
    if (partial.test(trimmed)) {
      return { intent, confidence: 0.85, source: "regex" };
    }
  }

  return { intent: "unknown", confidence: 0.0, source: "regex" };
}
