// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

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

// Cancel patterns MUST come before confirm — "non ci sono" must match cancel,
// not the "ci sono" substring in confirm. Order matters: first match wins.
// Trailing (?!\w) instead of \b — JS \b treats accented chars (è,ò,ì,ù) as
// non-word, so "sarò\b" fails. (?!\w) correctly handles accented endings.
//
// "colloquial" patterns (va bene, perfetto, ci sono, non ci sono, etc.) are
// ambiguous inside longer messages — they only match short messages (≤5 words).
// "explicit" patterns (confermo, annulla, cancella) always match.

const MAX_COLLOQUIAL_WORDS = 5;

const PATTERNS: readonly { intent: MessageIntent; exact: RegExp; partial: RegExp; colloquial?: RegExp }[] = [
  {
    intent: "cancel",
    exact: /^(no|annull[oa]|cancell[oa]|disdic[oa])$/i,
    // Explicit: always match even in long messages
    partial: /\b(annull|cancel|disdic|devo\s+disdire|devo\s+cancellare)(?!\w)/i,
    // Colloquial: only match short messages
    colloquial: /\b(no|non\s+veng[oa]|non\s+riesc[oa]|non\s+posso|non\s+ce\s+la\s+faccio|non\s+vengo\s+pi[uù]|non\s+posso\s+venire|non\s+riesco\s+a\s+venire|non\s+ci\s+sono|non\s+ci\s+sar[oò]|non\s+ci\s+sto)(?!\w)/i,
  },
  {
    intent: "confirm",
    exact: /^(s[iì]|yes|ok|confermo|conferma|certo|presente|perfetto|va\s+bene|d[']?accordo)$/i,
    // Explicit: always match even in long messages
    partial: /\b(conferm[oa]|accett[oa])(?!\w)/i,
    // Colloquial: only match short messages
    colloquial: /\b(s[iì]|yes|ok|ci\s+sono|ci\s+sar[oò]|vengo|ci\s+sto|presente|certo|certamente|va\s+bene|perfetto|d[']?accordo|sicuro|assolutamente|ovvio|senz[']?altro)(?!\w)/i,
  },
  {
    intent: "accept_offer",
    exact: /^(accett[oa]|prendo|vado|s[iì])$/i,
    partial: /\b(accett[oa]|prend[oa]|vad[oa]|piacere)(?!\w)/i,
  },
  {
    intent: "decline_offer",
    exact: /^(rifiut[oa]|no|passo)$/i,
    partial: /\b(rifiut|non\s+mi\s+interessa|passo)(?!\w)/i,
  },
  {
    intent: "slot_select",
    exact: /^[123]$/,
    partial: /\b(opzione\s*[123]|scelt[oa]\s*[123]|prefer\w*\s*[123])(?!\w)/i,
  },
  {
    intent: "book_appointment",
    exact: /^(prenotare|prenota|prenotazione|appuntamento)$/i,
    partial: /\b(prenot[aeio]|appuntamento|fissare|vorrei\s+(un\s+)?appuntamento|prenotare\s+una?\s+visita|nuov[oa]\s+visita)(?!\w)/i,
  },
  {
    intent: "join_waitlist",
    exact: /^(lista|lista\s+d[ie]?\s*attesa|attesa)$/i,
    partial: /\b(lista\s*d[ie']?\s*attesa|mett[aeio]\w*\s+in\s+lista|lista\s+attesa)(?!\w)/i,
  },
  {
    intent: "reschedule",
    exact: /^(riprogrammare|riprogramma|spostare|cambiare\s+orario|cambiare\s+data)$/i,
    partial: /\b(riprogramm[aeo]\w*|spostare\s+(l[a']?\s*)?(?:appuntamento|visita)|cambiare\s+(?:orario|data)|nuovo\s+orario|altra\s+data)(?!\w)/i,
  },
];

export function classifyIntent(text: string): IntentResult {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).length;
  const isShort = wordCount <= MAX_COLLOQUIAL_WORDS;

  for (const { intent, exact, partial, colloquial } of PATTERNS) {
    if (exact.test(trimmed)) {
      return { intent, confidence: 1.0, source: "regex" };
    }
    // Explicit patterns always match
    if (partial.test(trimmed)) {
      return { intent, confidence: 0.85, source: "regex" };
    }
    // Colloquial patterns only match short messages to avoid false positives
    if (colloquial && isShort && colloquial.test(trimmed)) {
      return { intent, confidence: 0.85, source: "regex" };
    }
  }

  return { intent: "unknown", confidence: 0.0, source: "regex" };
}
