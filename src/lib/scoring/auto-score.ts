// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Opportunistic auto-scoring for appointments and waitlist entries.
 *
 * Runs in the background on GET requests. Finds records with null scores,
 * computes them, and persists the results. This ensures the AI backfill
 * system always has risk/urgency data to make decisions.
 *
 * Fire-and-forget — errors are logged but never thrown to callers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeRiskScore } from "./risk-score";
import { computeWaitlistScore } from "./waitlist-score";
import { calculateInitialPriority } from "./waitlist-score";
import type { ClinicalUrgency, TimeSlot } from "@/lib/types";

const BATCH_SIZE = 50;

// ── Appointments ──────────────────────────────────────────────────────

interface UnscoredAppointment {
  readonly id: string;
  readonly patient_id: string;
  readonly scheduled_at: string;
  readonly created_at: string;
  readonly tenant_id: string;
}

/**
 * Find appointments with null risk_score and compute scores for them.
 * Called opportunistically from the appointments GET endpoint.
 */
export async function autoScoreAppointments(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<number> {
  try {
    const { data: unscored, error } = await supabase
      .from("appointments")
      .select("id, patient_id, scheduled_at, created_at, tenant_id")
      .eq("tenant_id", tenantId)
      .is("risk_score", null)
      .in("status", ["scheduled", "reminder_pending", "reminder_sent", "confirmed"])
      .limit(BATCH_SIZE);

    if (error || !unscored || unscored.length === 0) return 0;

    const typedRows = unscored as UnscoredAppointment[];

    // Collect unique patient IDs for batch stats lookup
    const patientIds = [...new Set(typedRows.map((a) => a.patient_id))];

    // Batch fetch appointment stats per patient
    const { data: allStats } = await supabase
      .from("appointments")
      .select("patient_id, status")
      .eq("tenant_id", tenantId)
      .in("patient_id", patientIds);

    const statsMap = new Map<string, { total: number; noShows: number }>();
    for (const row of allStats ?? []) {
      const prev = statsMap.get(row.patient_id) ?? { total: 0, noShows: 0 };
      statsMap.set(row.patient_id, {
        total: prev.total + 1,
        noShows: prev.noShows + (row.status === "no_show" ? 1 : 0),
      });
    }

    let scored = 0;
    for (const appt of typedRows) {
      const stats = statsMap.get(appt.patient_id) ?? { total: 0, noShows: 0 };
      const result = computeRiskScore({
        totalAppointments: stats.total,
        noShows: stats.noShows,
        scheduledAt: new Date(appt.scheduled_at),
        createdAt: new Date(appt.created_at),
      });

      const { error: updateErr } = await supabase
        .from("appointments")
        .update({
          risk_score: result.score,
          risk_reasoning: result.reasoning,
          risk_scored_at: new Date().toISOString(),
        })
        .eq("id", appt.id);

      if (!updateErr) scored++;
    }

    if (scored > 0) {
      console.info(`[AutoScore] Scored ${scored} appointments for tenant ${tenantId}`);
    }
    return scored;
  } catch (err) {
    console.error("[AutoScore] Appointment scoring failed:", err);
    return 0;
  }
}

// ── Waitlist Entries ──────────────────────────────────────────────────

interface UnscoredWaitlistEntry {
  readonly id: string;
  readonly patient_id: string;
  readonly clinical_urgency: ClinicalUrgency;
  readonly preferred_time_slots: TimeSlot[] | null;
  readonly flexible_time: boolean;
  readonly distance_km: number | null;
  readonly preferred_provider: string | null;
  readonly payment_category: string | null;
  readonly created_at: string;
  readonly tenant_id: string;
}

/**
 * Find waitlist entries with null smart_score and compute scores for them.
 * Called opportunistically from the waitlist GET endpoint.
 */
export async function autoScoreWaitlistEntries(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<number> {
  try {
    const { data: unscored, error } = await supabase
      .from("waitlist_entries")
      .select(
        "id, patient_id, clinical_urgency, preferred_time_slots, flexible_time, distance_km, preferred_provider, payment_category, created_at, tenant_id",
      )
      .eq("tenant_id", tenantId)
      .is("smart_score", null)
      .in("status", ["waiting", "offer_pending"])
      .limit(BATCH_SIZE);

    if (error || !unscored || unscored.length === 0) return 0;

    const typedRows = unscored as UnscoredWaitlistEntry[];

    // Batch fetch appointment stats per patient
    const patientIds = [...new Set(typedRows.map((e) => e.patient_id))];

    const { data: allStats } = await supabase
      .from("appointments")
      .select("patient_id, status")
      .eq("tenant_id", tenantId)
      .in("patient_id", patientIds);

    const statsMap = new Map<string, { total: number; noShows: number }>();
    for (const row of allStats ?? []) {
      const prev = statsMap.get(row.patient_id) ?? { total: 0, noShows: 0 };
      statsMap.set(row.patient_id, {
        total: prev.total + 1,
        noShows: prev.noShows + (row.status === "no_show" ? 1 : 0),
      });
    }

    let scored = 0;
    for (const entry of typedRows) {
      const stats = statsMap.get(entry.patient_id) ?? { total: 0, noShows: 0 };

      const smartScore = computeWaitlistScore({
        clinicalUrgency: entry.clinical_urgency,
        patientNoShows: stats.noShows,
        patientTotal: stats.total,
        preferredTimeSlots: entry.preferred_time_slots ?? [],
        createdAt: new Date(entry.created_at),
        distanceKm: entry.distance_km,
        preferredProvider: entry.preferred_provider,
        paymentCategory: entry.payment_category,
      });

      const priority = calculateInitialPriority({
        flexibleTime: entry.flexible_time,
        clinicalUrgency: entry.clinical_urgency,
      });

      const { error: updateErr } = await supabase
        .from("waitlist_entries")
        .update({
          smart_score: smartScore.total,
          smart_score_breakdown: smartScore,
          priority_score: priority.score,
          priority_reason: priority.reason,
        })
        .eq("id", entry.id);

      if (!updateErr) scored++;
    }

    if (scored > 0) {
      console.info(`[AutoScore] Scored ${scored} waitlist entries for tenant ${tenantId}`);
    }
    return scored;
  } catch (err) {
    console.error("[AutoScore] Waitlist scoring failed:", err);
    return 0;
  }
}
