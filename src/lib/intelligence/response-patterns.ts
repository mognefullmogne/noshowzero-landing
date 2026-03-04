/**
 * Patient Response Pattern Learning
 *
 * Tracks when each patient responds to messages and computes optimal
 * contact timing. Used to:
 *   - Pick the best channel (WhatsApp vs SMS) based on response rates
 *   - Time future messages at the hour when the patient is most responsive
 *   - Provide avg response time for candidate scoring (responsiveness factor)
 *
 * Data is stored as JSONB on the patients table (response_patterns column)
 * to avoid an extra table and keep reads fast (single row fetch).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessageChannel } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single recorded response event — stored in the JSONB array. */
export interface ResponseRecord {
  readonly channel: MessageChannel;
  readonly sentAt: string;      // ISO 8601
  readonly respondedAt: string; // ISO 8601
  readonly responseMinutes: number;
  readonly hourOfDay: number;   // 0-23 of respondedAt
  readonly dayOfWeek: number;   // 0=Sun … 6=Sat of respondedAt
}

/** Aggregated patterns derived from the records array. */
export interface ResponsePatterns {
  readonly records: readonly ResponseRecord[];
  readonly updatedAt: string;
}

/** Result of getOptimalContactTime. */
export interface OptimalContactTime {
  readonly channel: MessageChannel;
  readonly bestHourOfDay: number;
  readonly avgResponseMinutes: number;
  readonly dataPoints: number;
}

// Minimum number of records needed before we trust the data
const MIN_DATA_POINTS = 3;

// Keep a rolling window of the most recent records to bound storage
const MAX_RECORDS = 50;

// Default fallback when we have insufficient data
const DEFAULT_CONTACT_TIME: OptimalContactTime = Object.freeze({
  channel: "whatsapp",
  bestHourOfDay: 10,
  avgResponseMinutes: 30,
  dataPoints: 0,
});

// ---------------------------------------------------------------------------
// Record a new response
// ---------------------------------------------------------------------------

/**
 * Record a patient's response pattern after they reply to a message.
 * Appends to the JSONB array on the patients table, keeping at most MAX_RECORDS.
 *
 * Pure append — never mutates existing records.
 */
export async function recordResponsePattern(
  supabase: SupabaseClient,
  patientId: string,
  channel: MessageChannel,
  sentAt: Date,
  respondedAt: Date
): Promise<{ success: boolean; error?: string }> {
  // Validate inputs
  if (respondedAt <= sentAt) {
    return { success: false, error: "respondedAt must be after sentAt" };
  }

  const responseMinutes = Math.round(
    (respondedAt.getTime() - sentAt.getTime()) / 60_000
  );

  const newRecord: ResponseRecord = Object.freeze({
    channel,
    sentAt: sentAt.toISOString(),
    respondedAt: respondedAt.toISOString(),
    responseMinutes,
    hourOfDay: respondedAt.getHours(),
    dayOfWeek: respondedAt.getDay(),
  });

  // Fetch current patterns
  const { data: patient, error: fetchError } = await supabase
    .from("patients")
    .select("response_patterns")
    .eq("id", patientId)
    .maybeSingle();

  if (fetchError) {
    console.error("[ResponsePatterns] Failed to fetch patient:", fetchError);
    return { success: false, error: fetchError.message };
  }

  const existing: ResponsePatterns | null = patient?.response_patterns ?? null;
  const existingRecords: readonly ResponseRecord[] = existing?.records ?? [];

  // Append new record, cap at MAX_RECORDS (keep newest)
  const allRecords = [...existingRecords, newRecord];
  const trimmedRecords =
    allRecords.length > MAX_RECORDS
      ? allRecords.slice(allRecords.length - MAX_RECORDS)
      : allRecords;

  const updated: ResponsePatterns = {
    records: trimmedRecords,
    updatedAt: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("patients")
    .update({ response_patterns: updated })
    .eq("id", patientId);

  if (updateError) {
    console.error("[ResponsePatterns] Failed to update patient:", updateError);
    return { success: false, error: updateError.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Get optimal contact time
// ---------------------------------------------------------------------------

/**
 * Analyze a patient's response history and return the optimal channel,
 * hour of day, and expected response time.
 *
 * Falls back to sensible defaults if fewer than MIN_DATA_POINTS records exist.
 */
export async function getOptimalContactTime(
  supabase: SupabaseClient,
  patientId: string
): Promise<OptimalContactTime> {
  const { data: patient, error } = await supabase
    .from("patients")
    .select("response_patterns, preferred_channel")
    .eq("id", patientId)
    .maybeSingle();

  if (error || !patient) {
    return DEFAULT_CONTACT_TIME;
  }

  const patterns: ResponsePatterns | null = patient.response_patterns ?? null;
  const records = patterns?.records ?? [];

  if (records.length < MIN_DATA_POINTS) {
    // Not enough data — return defaults with the patient's existing preference
    return {
      ...DEFAULT_CONTACT_TIME,
      channel: (patient.preferred_channel as MessageChannel) ?? "whatsapp",
      dataPoints: records.length,
    };
  }

  return computeOptimalFromRecords(records);
}

/**
 * Compute optimal contact time from a patient's response history.
 * Pure function — only depends on the provided records.
 */
export function computeOptimalFromRecords(
  records: readonly ResponseRecord[]
): OptimalContactTime {
  if (records.length < MIN_DATA_POINTS) {
    return DEFAULT_CONTACT_TIME;
  }

  // 1. Best channel: compare response rates by channel
  const channel = pickBestChannel(records);

  // 2. Best hour: find the hour with the fastest avg response time
  const bestHourOfDay = pickBestHour(records);

  // 3. Overall avg response time
  const totalMinutes = records.reduce((sum, r) => sum + r.responseMinutes, 0);
  const avgResponseMinutes = Math.round(totalMinutes / records.length);

  return Object.freeze({
    channel,
    bestHourOfDay,
    avgResponseMinutes,
    dataPoints: records.length,
  });
}

// ---------------------------------------------------------------------------
// Get average response minutes (for candidate scoring)
// ---------------------------------------------------------------------------

/**
 * Quick lookup: returns the average response time in minutes for a patient.
 * Returns null if insufficient data.
 */
export async function getAvgResponseMinutes(
  supabase: SupabaseClient,
  patientId: string
): Promise<number | null> {
  const { data: patient, error } = await supabase
    .from("patients")
    .select("response_patterns")
    .eq("id", patientId)
    .maybeSingle();

  if (error || !patient) return null;

  const patterns: ResponsePatterns | null = patient.response_patterns ?? null;
  const records = patterns?.records ?? [];

  if (records.length < MIN_DATA_POINTS) return null;

  const totalMinutes = records.reduce((sum, r) => sum + r.responseMinutes, 0);
  return Math.round(totalMinutes / records.length);
}

// ---------------------------------------------------------------------------
// Internal helpers — pure functions
// ---------------------------------------------------------------------------

function pickBestChannel(records: readonly ResponseRecord[]): MessageChannel {
  const channelStats = new Map<MessageChannel, { count: number; totalMin: number }>();

  for (const r of records) {
    const prev = channelStats.get(r.channel) ?? { count: 0, totalMin: 0 };
    channelStats.set(r.channel, {
      count: prev.count + 1,
      totalMin: prev.totalMin + r.responseMinutes,
    });
  }

  // Pick channel with most responses; break ties by faster avg response
  let bestChannel: MessageChannel = "whatsapp";
  let bestCount = 0;
  let bestAvg = Infinity;

  for (const [ch, stats] of channelStats) {
    const avg = stats.totalMin / stats.count;
    if (stats.count > bestCount || (stats.count === bestCount && avg < bestAvg)) {
      bestChannel = ch;
      bestCount = stats.count;
      bestAvg = avg;
    }
  }

  return bestChannel;
}

function pickBestHour(records: readonly ResponseRecord[]): number {
  // Group by hour of day, compute avg response time per hour
  const hourStats = new Map<number, { count: number; totalMin: number }>();

  for (const r of records) {
    const prev = hourStats.get(r.hourOfDay) ?? { count: 0, totalMin: 0 };
    hourStats.set(r.hourOfDay, {
      count: prev.count + 1,
      totalMin: prev.totalMin + r.responseMinutes,
    });
  }

  // Pick hour with fastest response (min avg), requiring at least 1 record
  let bestHour = 10; // fallback
  let bestAvg = Infinity;

  for (const [hour, stats] of hourStats) {
    const avg = stats.totalMin / stats.count;
    if (avg < bestAvg) {
      bestAvg = avg;
      bestHour = hour;
    }
  }

  return bestHour;
}
