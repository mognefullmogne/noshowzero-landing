/**
 * Overbooking Recommendations
 *
 * Analyzes historical no-show rates by slot pattern (day + hour) and
 * recommends overbooking when a pattern consistently shows high no-show rates.
 *
 * Informational only — staff decides whether to act on recommendations.
 * All user-facing text in Italian.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverbookingRecommendation {
  readonly dayOfWeek: number;
  readonly hour: number;
  readonly dayLabel: string;             // Italian day name
  readonly timeLabel: string;            // "HH:00"
  readonly historicalNoShowRate: number;  // 0.0 - 1.0
  readonly sampleSize: number;
  readonly recommendation: string;       // Italian recommendation text
  readonly confidence: "alta" | "media";
}

// Thresholds
const MIN_NOSHOW_RATE = 0.30;       // Only recommend for >30% no-show rate
const MIN_DATA_POINTS = 10;          // Need at least 10 data points
const HIGH_CONFIDENCE_THRESHOLD = 20; // 20+ data points = high confidence

const ITALIAN_DAYS: readonly string[] = [
  "Domenica", "Lunedi", "Martedi", "Mercoledi",
  "Giovedi", "Venerdi", "Sabato",
];

// ---------------------------------------------------------------------------
// Get overbooking recommendations
// ---------------------------------------------------------------------------

/**
 * Analyze historical no-show rate by slot pattern for a specific date.
 * Returns overbooking recommendations for slots exceeding the threshold.
 */
export async function getOverbookingRecommendations(
  supabase: SupabaseClient,
  tenantId: string,
  date: string
): Promise<readonly OverbookingRecommendation[]> {
  // Fetch historical data (completed + no_show only = reliable outcomes)
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("scheduled_at, status")
    .eq("tenant_id", tenantId)
    .in("status", ["completed", "no_show"])
    .lt("scheduled_at", new Date().toISOString())
    .limit(2000);

  if (error) {
    console.error("[Overbooking] Query error:", error);
    return [];
  }

  if (!appointments || appointments.length === 0) return [];

  // Get the day of week for the requested date
  const requestedDow = new Date(`${date}T12:00:00Z`).getUTCDay();

  // Build stats by day+hour pattern
  const patternStats = new Map<
    string,
    { dayOfWeek: number; hour: number; total: number; noShows: number }
  >();

  for (const appt of appointments) {
    const d = new Date(appt.scheduled_at);
    const dow = d.getUTCDay();
    const h = d.getUTCHours();
    const key = `${dow}-${h}`;

    const prev = patternStats.get(key) ?? { dayOfWeek: dow, hour: h, total: 0, noShows: 0 };
    patternStats.set(key, {
      dayOfWeek: dow,
      hour: h,
      total: prev.total + 1,
      noShows: prev.noShows + (appt.status === "no_show" ? 1 : 0),
    });
  }

  // Filter to requested day, apply thresholds, build recommendations
  const recommendations: OverbookingRecommendation[] = [];

  for (const stats of patternStats.values()) {
    // Only look at the requested day
    if (stats.dayOfWeek !== requestedDow) continue;

    // Need minimum data points
    if (stats.total < MIN_DATA_POINTS) continue;

    const noShowRate = stats.noShows / stats.total;

    // Only recommend if no-show rate exceeds threshold
    if (noShowRate < MIN_NOSHOW_RATE) continue;

    const confidence = stats.total >= HIGH_CONFIDENCE_THRESHOLD ? "alta" : "media";
    const noShowPercent = Math.round(noShowRate * 100);

    recommendations.push({
      dayOfWeek: stats.dayOfWeek,
      hour: stats.hour,
      dayLabel: ITALIAN_DAYS[stats.dayOfWeek],
      timeLabel: `${stats.hour.toString().padStart(2, "0")}:00`,
      historicalNoShowRate: noShowRate,
      sampleSize: stats.total,
      recommendation: buildRecommendationText(
        ITALIAN_DAYS[stats.dayOfWeek],
        stats.hour,
        noShowPercent,
        stats.total,
        confidence
      ),
      confidence,
    });
  }

  // Sort by no-show rate descending (worst slots first)
  return recommendations.sort((a, b) => b.historicalNoShowRate - a.historicalNoShowRate);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildRecommendationText(
  dayLabel: string,
  hour: number,
  noShowPercent: number,
  sampleSize: number,
  confidence: "alta" | "media"
): string {
  const timeLabel = `${hour.toString().padStart(2, "0")}:00`;
  const confidenceLabel = confidence === "alta" ? "affidabilita' alta" : "affidabilita' media";

  return (
    `Lo slot ${dayLabel} alle ${timeLabel} ha un tasso di assenza del ${noShowPercent}% ` +
    `(su ${sampleSize} appuntamenti, ${confidenceLabel}). ` +
    `Si consiglia di aggiungere 1 appuntamento extra per compensare le assenze previste.`
  );
}
