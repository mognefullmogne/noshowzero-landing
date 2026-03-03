/**
 * Find and rank waitlist candidates for a cancelled appointment slot.
 * Uses smart scoring to match candidates based on urgency, reliability,
 * time preference, waiting time, distance, provider, and payment.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SmartScoreBreakdown } from "@/lib/types";
import { computeWaitlistScore } from "@/lib/scoring/waitlist-score";

export interface RankedCandidate {
  readonly waitlistEntryId: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly patientPhone: string | null;
  readonly patientEmail: string | null;
  readonly preferredChannel: "whatsapp" | "sms" | "email";
  readonly smartScore: SmartScoreBreakdown;
}

interface SlotDetails {
  readonly appointmentId: string;
  readonly tenantId: string;
  readonly serviceName: string;
  readonly serviceCode: string | null;
  readonly providerName: string | null;
  readonly locationName: string | null;
  readonly scheduledAt: Date;
  readonly durationMin: number;
  readonly paymentCategory: string | null;
}

/**
 * Query waitlist for matching candidates, score & rank them by smart_score DESC.
 * Excludes candidates who have already exhausted their max_offers.
 */
export async function findCandidates(
  supabase: SupabaseClient,
  slot: SlotDetails,
  limit: number = 10
): Promise<readonly RankedCandidate[]> {
  // Slot must be in the future
  if (slot.scheduledAt <= new Date()) {
    console.warn("[Backfill] Slot is in the past — skipping candidate search");
    return [];
  }

  // Query active waitlist entries matching service + tenant
  let query = supabase
    .from("waitlist_entries")
    .select("*, patient:patients(*)")
    .eq("tenant_id", slot.tenantId)
    .eq("status", "waiting")
    .eq("service_name", slot.serviceName);

  // Filter by location if specified (sanitize to prevent PostgREST filter injection)
  if (slot.locationName) {
    const safeLocation = slot.locationName.replace(/[,()."'\\]/g, "");
    query = query.or(`location_name.eq.${safeLocation},location_name.is.null`);
  }

  const { data: entries, error } = await query.limit(50);

  if (error) {
    console.error("[Backfill] Failed to query waitlist:", error);
    return [];
  }

  if (!entries || entries.length === 0) return [];

  // Filter: valid_until not expired, offers_sent < max_offers
  const now = new Date();
  const validEntries = entries.filter((e) => {
    if (e.offers_sent >= e.max_offers) return false;
    if (e.valid_until && new Date(e.valid_until) < now) return false;
    return true;
  });

  // Count no-shows per patient (for reliability scoring)
  const patientIds = [...new Set(validEntries.map((e) => e.patient_id))];
  const { data: apptStats } = await supabase
    .from("appointments")
    .select("patient_id, status")
    .eq("tenant_id", slot.tenantId)
    .in("patient_id", patientIds);

  const statsMap = new Map<string, { total: number; noShows: number }>();
  for (const a of apptStats ?? []) {
    const prev = statsMap.get(a.patient_id) ?? { total: 0, noShows: 0 };
    statsMap.set(a.patient_id, {
      total: prev.total + 1,
      noShows: prev.noShows + (a.status === "no_show" ? 1 : 0),
    });
  }

  // Score each candidate against this specific slot
  const scored: RankedCandidate[] = validEntries
    .map((entry) => {
      const patient = entry.patient as { first_name: string; last_name: string; phone: string | null; email: string | null; preferred_channel: string } | null;
      if (!patient) return null;

      const stats = statsMap.get(entry.patient_id) ?? { total: 0, noShows: 0 };

      const smartScore = computeWaitlistScore({
        clinicalUrgency: entry.clinical_urgency,
        patientNoShows: stats.noShows,
        patientTotal: stats.total,
        preferredTimeSlots: entry.preferred_time_slots ?? [],
        createdAt: new Date(entry.created_at),
        distanceKm: entry.distance_km,
        preferredProvider: entry.preferred_provider,
        slotProvider: slot.providerName,
        paymentCategory: entry.payment_category,
        slotPaymentCategory: slot.paymentCategory,
        slotStartsAt: slot.scheduledAt,
      });

      return {
        waitlistEntryId: entry.id,
        patientId: entry.patient_id,
        patientName: `${patient.first_name} ${patient.last_name}`,
        patientPhone: patient.phone,
        patientEmail: patient.email,
        preferredChannel: patient.preferred_channel as "whatsapp" | "sms" | "email",
        smartScore,
      };
    })
    .filter((c): c is RankedCandidate => c !== null);

  // Sort by total smart score descending
  scored.sort((a, b) => b.smartScore.total - a.smartScore.total);

  return scored.slice(0, limit);
}
