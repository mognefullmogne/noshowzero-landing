// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Patient Conversation Memory
 *
 * Extracts and stores patient preferences from WhatsApp conversations.
 * Uses Claude Haiku to extract structured facts from messages.
 * Stores memory in the patients.response_patterns JSONB column
 * under a dedicated "memory" key, alongside existing response pattern data.
 *
 * Rolling window: keeps last 20 facts, newest first.
 * Only processes messages with confidence > 0.7.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single extracted memory fact from a patient interaction. */
export interface MemoryFact {
  readonly extractedAt: string;        // ISO 8601
  readonly preferredTimes?: string[];  // e.g. ["mattina", "09:00-11:00"]
  readonly preferredDays?: string[];   // e.g. ["lunedi", "martedi"]
  readonly preferredProvider?: string; // e.g. "Dr. Rossi"
  readonly language?: string;          // e.g. "it-informal", "it-formal"
  readonly communicationStyle?: string; // e.g. "informal", "formal", "brief"
  readonly notes?: string[];           // free-form notes e.g. ["cancella spesso per lavoro"]
}

/** Stored patient memory — lives under patients.response_patterns.memory */
export interface PatientMemory {
  readonly facts: readonly MemoryFact[];
  readonly updatedAt: string;
}

/** Raw JSONB shape of response_patterns column (may contain both memory and records) */
interface PatientResponsePatterns {
  readonly memory?: PatientMemory;
  // response_patterns from intelligence layer also lives here
  readonly records?: unknown[];
  readonly updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MEMORY_FACTS = 20;
const MIN_CONFIDENCE_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// updatePatientMemory
// ---------------------------------------------------------------------------

/**
 * Extract preferences from a patient message and store them in the
 * patient's memory record. Fire-and-forget friendly — errors are logged
 * but never thrown.
 *
 * Only processes messages with confidence > 0.7 to avoid storing noise.
 */
export async function updatePatientMemory(
  supabase: SupabaseClient,
  patientId: string,
  message: string,
  intent: string,
  confidence: number
): Promise<void> {
  // Skip low-confidence or purely mechanical intents
  if (confidence < MIN_CONFIDENCE_THRESHOLD) {
    return;
  }

  // Skip mechanical confirm/decline — no preference signals there
  if (intent === "confirm" || intent === "cancel" || intent === "accept_offer" || intent === "decline_offer") {
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return;
  }

  try {
    const extracted = await extractFactsFromMessage(message);
    if (!extracted) {
      return;
    }

    // Fetch current patterns from DB
    const { data: patient, error: fetchError } = await supabase
      .from("patients")
      .select("response_patterns")
      .eq("id", patientId)
      .maybeSingle();

    if (fetchError) {
      console.error("[PatientMemory] Failed to fetch patient:", fetchError);
      return;
    }

    const existing: PatientResponsePatterns = patient?.response_patterns ?? {};
    const currentMemory: PatientMemory = existing.memory ?? { facts: [], updatedAt: new Date().toISOString() };

    // Prepend new fact (newest first), cap at MAX_MEMORY_FACTS
    const newFact: MemoryFact = {
      ...extracted,
      extractedAt: new Date().toISOString(),
    };

    const allFacts = [newFact, ...currentMemory.facts];
    const trimmedFacts = allFacts.slice(0, MAX_MEMORY_FACTS);

    const updatedMemory: PatientMemory = {
      facts: trimmedFacts,
      updatedAt: new Date().toISOString(),
    };

    // Merge memory back into existing response_patterns (preserve records key)
    const updatedPatterns: PatientResponsePatterns = {
      ...existing,
      memory: updatedMemory,
    };

    const { error: updateError } = await supabase
      .from("patients")
      .update({ response_patterns: updatedPatterns })
      .eq("id", patientId);

    if (updateError) {
      console.error("[PatientMemory] Failed to update patient memory:", updateError);
    }
  } catch (err) {
    // Fire-and-forget: never crash the caller
    console.error("[PatientMemory] Unexpected error:", err);
  }
}

// ---------------------------------------------------------------------------
// getPatientContext
// ---------------------------------------------------------------------------

/**
 * Retrieve stored memory and format it as a short Italian string
 * suitable for injection into AI prompts.
 *
 * Example output:
 *   "Preferisce mattina, parla italiano informale, ha cancellato 2 volte per lavoro"
 *
 * Returns an empty string if no meaningful memory exists.
 */
export async function getPatientContext(
  supabase: SupabaseClient,
  patientId: string
): Promise<string> {
  try {
    const { data: patient, error } = await supabase
      .from("patients")
      .select("response_patterns")
      .eq("id", patientId)
      .maybeSingle();

    if (error || !patient) {
      return "";
    }

    const patterns: PatientResponsePatterns = patient.response_patterns ?? {};
    const memory = patterns.memory;

    if (!memory || memory.facts.length === 0) {
      return "";
    }

    return formatMemoryAsContext(memory.facts);
  } catch (err) {
    console.error("[PatientMemory] Failed to load context:", err);
    return "";
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Call Claude Haiku to extract structured preferences from a message.
 * Returns null if nothing meaningful was extracted.
 */
async function extractFactsFromMessage(
  message: string
): Promise<Omit<MemoryFact, "extractedAt"> | null> {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ timeout: 8_000 });

    // Sanitize message before sending to AI
    const safeMessage = message
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
      .trim()
      .slice(0, 500);

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `Extract preferences and facts from this patient message. Return JSON with these optional fields (only include if mentioned):
- preferredTimes: string[] (e.g. ["mattina", "pomeriggio", "09:00"])
- preferredDays: string[] (e.g. ["lunedi", "martedi"])
- preferredProvider: string (doctor/provider name mentioned)
- language: string (e.g. "it-informal", "it-formal", "en")
- communicationStyle: string ("informal", "formal", "brief")
- notes: string[] (notable facts like "lavora la mattina", "ha bambini", "preferisce conferma via SMS")

If the message contains no extractable preferences, return: {"empty": true}
Return ONLY valid JSON. No explanation.`,
      messages: [{ role: "user", content: safeMessage }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return null;
    }

    const parsed = parseAIJson(content.text);
    if (!parsed || parsed.empty === true) {
      return null;
    }

    // Only keep known keys to avoid storing garbage
    const fact: Omit<MemoryFact, "extractedAt"> = {};
    if (Array.isArray(parsed.preferredTimes) && parsed.preferredTimes.length > 0) {
      (fact as Record<string, unknown>).preferredTimes = parsed.preferredTimes.map(String).slice(0, 5);
    }
    if (Array.isArray(parsed.preferredDays) && parsed.preferredDays.length > 0) {
      (fact as Record<string, unknown>).preferredDays = parsed.preferredDays.map(String).slice(0, 7);
    }
    if (typeof parsed.preferredProvider === "string" && parsed.preferredProvider.trim()) {
      (fact as Record<string, unknown>).preferredProvider = parsed.preferredProvider.trim().slice(0, 100);
    }
    if (typeof parsed.language === "string" && parsed.language.trim()) {
      (fact as Record<string, unknown>).language = parsed.language.trim().slice(0, 20);
    }
    if (typeof parsed.communicationStyle === "string" && parsed.communicationStyle.trim()) {
      (fact as Record<string, unknown>).communicationStyle = parsed.communicationStyle.trim().slice(0, 20);
    }
    if (Array.isArray(parsed.notes) && parsed.notes.length > 0) {
      (fact as Record<string, unknown>).notes = parsed.notes.map(String).slice(0, 5);
    }

    // If nothing was extracted, return null
    if (Object.keys(fact).length === 0) {
      return null;
    }

    return fact;
  } catch (err) {
    console.error("[PatientMemory] AI extraction failed:", err);
    return null;
  }
}

/**
 * Format stored memory facts into a concise Italian context string.
 * Aggregates across all facts (deduplicates and merges).
 */
export function formatMemoryAsContext(facts: readonly MemoryFact[]): string {
  if (facts.length === 0) return "";

  // Aggregate values across all facts
  const allPreferredTimes = new Set<string>();
  const allPreferredDays = new Set<string>();
  const allNotes = new Set<string>();
  let latestProvider: string | undefined;
  let latestLanguage: string | undefined;
  let latestStyle: string | undefined;

  for (const fact of facts) {
    fact.preferredTimes?.forEach((t) => allPreferredTimes.add(t));
    fact.preferredDays?.forEach((d) => allPreferredDays.add(d));
    fact.notes?.forEach((n) => allNotes.add(n));
    if (!latestProvider && fact.preferredProvider) latestProvider = fact.preferredProvider;
    if (!latestLanguage && fact.language) latestLanguage = fact.language;
    if (!latestStyle && fact.communicationStyle) latestStyle = fact.communicationStyle;
  }

  const parts: string[] = [];

  if (allPreferredTimes.size > 0) {
    parts.push(`Preferisce: ${[...allPreferredTimes].slice(0, 3).join(", ")}`);
  }
  if (allPreferredDays.size > 0) {
    parts.push(`Giorni preferiti: ${[...allPreferredDays].slice(0, 3).join(", ")}`);
  }
  if (latestProvider) {
    parts.push(`Preferisce ${latestProvider}`);
  }
  if (latestLanguage) {
    parts.push(`Lingua: ${latestLanguage}`);
  }
  if (latestStyle) {
    parts.push(`Stile: ${latestStyle}`);
  }
  if (allNotes.size > 0) {
    parts.push([...allNotes].slice(0, 3).join("; "));
  }

  return parts.join(", ");
}

/** Strip markdown fences and parse JSON safely. Returns null on failure. */
function parseAIJson(raw: string): Record<string, unknown> | null {
  try {
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/, "");
    cleaned = cleaned.trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;

    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
