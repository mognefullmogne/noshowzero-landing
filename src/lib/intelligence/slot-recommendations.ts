/**
 * Smart Scheduling Suggestions
 *
 * Analyzes historical appointment data to identify which time slots have
 * the best attendance rates. Used in:
 *   - Booking flow: annotate available slots with risk labels
 *   - Staff dashboard: show which slots to prefer when manually scheduling
 *   - WhatsApp booking: mention attendance quality in slot proposals
 *
 * All user-facing text is in Italian.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A slot pattern = day_of_week (0=Sun) + hour (0-23). */
export interface SlotPattern {
  readonly dayOfWeek: number;
  readonly hour: number;
}

/** Historical statistics for a slot pattern. */
export interface SlotPatternStats {
  readonly dayOfWeek: number;
  readonly hour: number;
  readonly totalAppointments: number;
  readonly noShows: number;
  readonly noShowRate: number;       // 0.0 - 1.0
  readonly attendanceRate: number;   // 1 - noShowRate
  readonly confidence: "alta" | "media" | "bassa"; // based on sample size
}

/** A recommended slot with attendance context. */
export interface SlotRecommendation {
  readonly dayOfWeek: number;
  readonly hour: number;
  readonly attendanceRate: number;
  readonly noShowRate: number;
  readonly riskLabel: SlotRiskLabel;
  readonly confidence: "alta" | "media" | "bassa";
  readonly sampleSize: number;
}

/** Italian risk labels for no-show frequency. */
export type SlotRiskLabel = "Alta frequenza" | "Nella media" | "Bassa frequenza";

// Thresholds
const HIGH_NOSHOW_THRESHOLD = 0.25;   // >25% no-shows = "Alta frequenza"
const LOW_NOSHOW_THRESHOLD = 0.10;    // <10% no-shows = "Bassa frequenza"
const MIN_SAMPLE_HIGH_CONFIDENCE = 20;
const MIN_SAMPLE_MEDIUM_CONFIDENCE = 10;

// ---------------------------------------------------------------------------
// Get slot recommendations
// ---------------------------------------------------------------------------

/**
 * Query historical appointments for a tenant and return slot patterns
 * ranked by attendance rate (best first).
 *
 * Optionally filters by service type for more specific recommendations.
 */
export async function getSlotRecommendations(
  supabase: SupabaseClient,
  tenantId: string,
  requestedDate: string,
  serviceType?: string
): Promise<readonly SlotRecommendation[]> {
  // Fetch historical completed + no_show appointments for this tenant
  // (only terminal statuses give us reliable outcome data)
  let query = supabase
    .from("appointments")
    .select("scheduled_at, status")
    .eq("tenant_id", tenantId)
    .in("status", ["completed", "no_show"])
    .lt("scheduled_at", new Date().toISOString());

  if (serviceType) {
    query = query.ilike("service_name", `%${sanitizeForLike(serviceType)}%`);
  }

  const { data: appointments, error } = await query.limit(2000);

  if (error) {
    console.error("[SlotRecommendations] Query error:", error);
    return [];
  }

  if (!appointments || appointments.length === 0) return [];

  // Build pattern stats
  const patternMap = buildPatternStats(appointments);

  // Convert to recommendations, filter by requested day, sort by attendance
  const requestedDayOfWeek = new Date(`${requestedDate}T12:00:00Z`).getUTCDay();

  const recommendations = Array.from(patternMap.values())
    .filter((s) => s.dayOfWeek === requestedDayOfWeek)
    .map((stats): SlotRecommendation => ({
      dayOfWeek: stats.dayOfWeek,
      hour: stats.hour,
      attendanceRate: stats.attendanceRate,
      noShowRate: stats.noShowRate,
      riskLabel: computeRiskLabel(stats.noShowRate),
      confidence: stats.confidence,
      sampleSize: stats.totalAppointments,
    }))
    .sort((a, b) => b.attendanceRate - a.attendanceRate);

  return recommendations;
}

// ---------------------------------------------------------------------------
// Get risk label for a specific slot
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable Italian risk label for a specific day+hour combination.
 * Used to annotate slots in the booking UI and WhatsApp flow.
 */
export async function getSlotRiskLabel(
  supabase: SupabaseClient,
  dayOfWeek: number,
  hour: number,
  tenantId: string
): Promise<{ label: SlotRiskLabel; noShowRate: number; sampleSize: number }> {
  // Query historical data for this specific day+hour pattern
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("scheduled_at, status")
    .eq("tenant_id", tenantId)
    .in("status", ["completed", "no_show"])
    .lt("scheduled_at", new Date().toISOString())
    .limit(2000);

  if (error || !appointments || appointments.length === 0) {
    return { label: "Nella media", noShowRate: 0, sampleSize: 0 };
  }

  // Filter to matching day+hour
  const matching = appointments.filter((a) => {
    const d = new Date(a.scheduled_at);
    return d.getUTCDay() === dayOfWeek && d.getUTCHours() === hour;
  });

  if (matching.length === 0) {
    return { label: "Nella media", noShowRate: 0, sampleSize: 0 };
  }

  const noShows = matching.filter((a) => a.status === "no_show").length;
  const noShowRate = noShows / matching.length;

  return {
    label: computeRiskLabel(noShowRate),
    noShowRate,
    sampleSize: matching.length,
  };
}

// ---------------------------------------------------------------------------
// Annotate available slots with risk labels (for slot-finder integration)
// ---------------------------------------------------------------------------

export interface AnnotatedSlot {
  readonly slotId: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly providerName: string;
  readonly riskLabel: SlotRiskLabel;
  readonly attendanceRate: number;
}

/**
 * Annotate a list of available slots with historical attendance data.
 * Used by the booking orchestrator to enrich slot proposals.
 */
export async function annotateSlots(
  supabase: SupabaseClient,
  tenantId: string,
  slots: ReadonlyArray<{
    readonly slotId: string;
    readonly startAt: string;
    readonly endAt: string;
    readonly providerName: string;
  }>
): Promise<readonly AnnotatedSlot[]> {
  if (slots.length === 0) return [];

  // Fetch historical data once for all slots
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("scheduled_at, status")
    .eq("tenant_id", tenantId)
    .in("status", ["completed", "no_show"])
    .lt("scheduled_at", new Date().toISOString())
    .limit(2000);

  if (error || !appointments || appointments.length === 0) {
    // No historical data — return neutral labels
    return slots.map((s) => ({
      ...s,
      riskLabel: "Nella media" as SlotRiskLabel,
      attendanceRate: 0,
    }));
  }

  const patternMap = buildPatternStats(appointments);

  return slots.map((slot) => {
    const slotDate = new Date(slot.startAt);
    const key = patternKey(slotDate.getUTCDay(), slotDate.getUTCHours());
    const stats = patternMap.get(key);

    if (!stats || stats.totalAppointments < 3) {
      return {
        ...slot,
        riskLabel: "Nella media" as SlotRiskLabel,
        attendanceRate: 0,
      };
    }

    return {
      ...slot,
      riskLabel: computeRiskLabel(stats.noShowRate),
      attendanceRate: stats.attendanceRate,
    };
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildPatternStats(
  appointments: ReadonlyArray<{ scheduled_at: string; status: string }>
): Map<string, SlotPatternStats> {
  const accumulator = new Map<
    string,
    { dayOfWeek: number; hour: number; total: number; noShows: number }
  >();

  for (const appt of appointments) {
    const d = new Date(appt.scheduled_at);
    const dow = d.getUTCDay();
    const h = d.getUTCHours();
    const key = patternKey(dow, h);

    const prev = accumulator.get(key) ?? { dayOfWeek: dow, hour: h, total: 0, noShows: 0 };
    accumulator.set(key, {
      dayOfWeek: dow,
      hour: h,
      total: prev.total + 1,
      noShows: prev.noShows + (appt.status === "no_show" ? 1 : 0),
    });
  }

  const result = new Map<string, SlotPatternStats>();
  for (const [key, val] of accumulator) {
    const noShowRate = val.noShows / val.total;
    result.set(key, {
      dayOfWeek: val.dayOfWeek,
      hour: val.hour,
      totalAppointments: val.total,
      noShows: val.noShows,
      noShowRate,
      attendanceRate: 1 - noShowRate,
      confidence: computeConfidence(val.total),
    });
  }

  return result;
}

function patternKey(dayOfWeek: number, hour: number): string {
  return `${dayOfWeek}-${hour}`;
}

function computeRiskLabel(noShowRate: number): SlotRiskLabel {
  if (noShowRate >= HIGH_NOSHOW_THRESHOLD) return "Alta frequenza";
  if (noShowRate <= LOW_NOSHOW_THRESHOLD) return "Bassa frequenza";
  return "Nella media";
}

function computeConfidence(sampleSize: number): "alta" | "media" | "bassa" {
  if (sampleSize >= MIN_SAMPLE_HIGH_CONFIDENCE) return "alta";
  if (sampleSize >= MIN_SAMPLE_MEDIUM_CONFIDENCE) return "media";
  return "bassa";
}

/** Escape special SQL LIKE characters. */
function sanitizeForLike(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}
