// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Find and rank candidate patients for a cancelled appointment slot.
 *
 * Queries the appointments table (not waitlist_entries) for scheduled patients
 * who could move to an earlier slot. Applies filtering, deduplication, and
 * scoring via the 4-factor computeCandidateScore algorithm
 * (appointmentDistance + reliability + urgencyBonus + responsiveness).
 *
 * SLOT-01: Appointment-based candidate detection
 * SLOT-02: Candidate scoring and ranking
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidateScoreBreakdown } from "@/lib/types";
import { computeCandidateScore } from "@/lib/scoring/candidate-score";

export interface OpenSlotDetails {
  readonly appointmentId: string; // the cancelled appointment
  readonly tenantId: string;
  readonly cancellingPatientId: string; // exclude self-referential candidates
  readonly scheduledAt: Date; // the slot's time
  readonly durationMin: number; // for conflict detection
}

export interface RankedCandidate {
  readonly candidateAppointmentId: string; // the appointment being moved earlier
  readonly patientId: string;
  readonly patientName: string;
  readonly patientPhone: string | null;
  readonly patientEmail: string | null;
  readonly preferredChannel: "whatsapp" | "sms" | "email";
  readonly candidateScore: CandidateScoreBreakdown;
  readonly currentAppointmentAt: Date;
}

const MIN_LEAD_TIME_MS = 2 * 3_600_000; // 2 hours
const CANDIDATE_FETCH_LIMIT = 200; // fetch more than needed for post-query filtering
const ACTIVE_STATUSES = ["scheduled", "reminder_pending", "reminder_sent", "confirmed"] as const;

/** Shape of a row returned from the appointments query with joined patient data. */
interface AppointmentRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly patient_id: string;
  readonly scheduled_at: string;
  readonly duration_min: number;
  readonly status: string;
  readonly patient: {
    readonly id: string;
    readonly first_name: string;
    readonly last_name: string;
    readonly phone: string | null;
    readonly email: string | null;
    readonly preferred_channel: string;
    readonly response_patterns: {
      readonly records: ReadonlyArray<{ readonly responseMinutes: number }>;
    } | null;
  } | null;
}

/**
 * Returns a ranked list of candidate patients for an open appointment slot.
 *
 * Filtering rules applied in order:
 * 1. Slot must be at least 2 hours in the future
 * 2. Only appointments AFTER the open slot are considered
 * 3. Cancelling patient is excluded
 * 4. Patients who declined an offer in the last 24 hours are excluded
 * 5. Appointments that time-conflict with the open slot are excluded
 * 6. Deduplication: one entry per patient (farthest-out appointment kept)
 *
 * Results are scored by computeCandidateScore and sorted descending.
 */
export async function findCandidates(
  supabase: SupabaseClient,
  slot: OpenSlotDetails,
  limit: number = 50
): Promise<readonly RankedCandidate[]> {
  const now = new Date();

  // Guard: slot must not have fully elapsed, and needs minimum lead time
  const slotEndTime = new Date(slot.scheduledAt.getTime() + slot.durationMin * 60_000);
  if (slotEndTime <= now) {
    console.warn("[Backfill] Slot has fully elapsed — skipping candidate search");
    return [];
  }
  if (slot.scheduledAt.getTime() - now.getTime() < MIN_LEAD_TIME_MS && slot.scheduledAt > now) {
    console.warn("[Backfill] Slot is less than 2 hours away — skipping candidate search");
    return [];
  }

  // Fetch candidate appointments: scheduled AFTER the open slot, active statuses
  const { data: appointments, error: apptError } = await supabase
    .from("appointments")
    .select("*, patient:patients(id, first_name, last_name, phone, email, preferred_channel, response_patterns)")
    .eq("tenant_id", slot.tenantId)
    .in("status", ACTIVE_STATUSES)
    .gt("scheduled_at", slot.scheduledAt.toISOString())
    .neq("patient_id", slot.cancellingPatientId)
    .limit(CANDIDATE_FETCH_LIMIT);

  if (apptError) {
    console.error("[Backfill] Failed to query candidate appointments:", apptError);
    return [];
  }

  if (!appointments || appointments.length === 0) return [];

  const typedAppointments = appointments as AppointmentRow[];

  // Fetch patients in 24-hour decline cooldown
  const cooldownCutoff = new Date(now.getTime() - 24 * 3_600_000);
  const { data: declinedOffers } = await supabase
    .from("waitlist_offers")
    .select("patient_id")
    .eq("tenant_id", slot.tenantId)
    .eq("status", "declined")
    .gte("responded_at", cooldownCutoff.toISOString());

  const declinedPatientIds = new Set<string>(
    (declinedOffers ?? []).map((o: { patient_id: string }) => o.patient_id)
  );

  // Post-query filtering
  const filtered = typedAppointments.filter((appt) => {
    // Belt-and-suspenders: exclude cancelling patient even if DB filter missed them
    if (appt.patient_id === slot.cancellingPatientId) return false;

    // Exclude patients in 24-hour decline cooldown
    if (declinedPatientIds.has(appt.patient_id)) return false;

    // Exclude appointments scheduled at or before the open slot
    // (the DB query uses gt, but we double-check for safety)
    const apptAt = new Date(appt.scheduled_at);
    if (apptAt <= slot.scheduledAt) return false;

    // Exclude time-conflicting appointments
    if (hasTimeConflict(apptAt, appt.duration_min, slot.scheduledAt, slot.durationMin)) return false;

    return true;
  });

  if (filtered.length === 0) return [];

  // Deduplicate by patient_id — keep the farthest-out appointment per patient
  const deduped = deduplicateByPatient(filtered);

  // Fetch no-show stats for remaining patient IDs
  const patientIds = deduped.map((a) => a.patient_id);
  const { data: apptStats } = await supabase
    .from("appointments")
    .select("patient_id, status")
    .eq("tenant_id", slot.tenantId)
    .in("patient_id", patientIds);

  const statsMap = buildStatsMap(apptStats ?? []);

  // Score, sort, and cap
  const scored = deduped.map((appt) => {
    const patient = appt.patient;

    if (!patient) return null;

    const stats = statsMap.get(appt.patient_id) ?? { total: 0, noShows: 0 };

    // Extract avg response minutes from stored patterns (inline, no extra DB call)
    const avgResponseMinutes = extractAvgResponseMinutes(patient.response_patterns);

    const candidateScore = computeCandidateScore({
      appointmentScheduledAt: new Date(appt.scheduled_at),
      openSlotAt: slot.scheduledAt,
      patientNoShows: stats.noShows,
      patientTotal: stats.total,
      now,
      avgResponseMinutes,
    });

    const candidate: RankedCandidate = {
      candidateAppointmentId: appt.id,
      patientId: appt.patient_id,
      patientName: `${patient.first_name} ${patient.last_name}`,
      patientPhone: patient.phone,
      patientEmail: patient.email,
      preferredChannel: patient.preferred_channel as "whatsapp" | "sms" | "email",
      candidateScore,
      currentAppointmentAt: new Date(appt.scheduled_at),
    };

    return candidate;
  }).filter((c): c is RankedCandidate => c !== null);

  // Sort by total score descending
  const sorted = [...scored].sort((a, b) => b.candidateScore.total - a.candidateScore.total);

  return sorted.slice(0, limit);
}

/**
 * Check whether two appointments overlap in time.
 * Uses half-open interval comparison: [start, end)
 * Overlap condition: candidateStart < slotEnd AND slotStart < candidateEnd
 */
function hasTimeConflict(
  candidateStart: Date,
  candidateDurationMin: number,
  slotStart: Date,
  slotDurationMin: number
): boolean {
  const candidateEnd = new Date(candidateStart.getTime() + candidateDurationMin * 60_000);
  const slotEnd = new Date(slotStart.getTime() + slotDurationMin * 60_000);
  return candidateStart < slotEnd && slotStart < candidateEnd;
}

/**
 * Deduplicate appointments by patient_id, keeping the farthest-out appointment.
 * Patients with farther appointments benefit most from an earlier slot.
 */
function deduplicateByPatient(appointments: readonly AppointmentRow[]): AppointmentRow[] {
  const byPatient = new Map<string, AppointmentRow>();

  for (const appt of appointments) {
    const existing = byPatient.get(appt.patient_id);
    if (!existing || appt.scheduled_at > existing.scheduled_at) {
      byPatient.set(appt.patient_id, appt);
    }
  }

  return Array.from(byPatient.values());
}

/**
 * Build a map of patient_id → { total appointments, no-show count }.
 */
function buildStatsMap(
  apptStats: Array<{ patient_id: string; status: string }>
): Map<string, { total: number; noShows: number }> {
  const map = new Map<string, { total: number; noShows: number }>();

  for (const a of apptStats) {
    const prev = map.get(a.patient_id) ?? { total: 0, noShows: 0 };
    map.set(a.patient_id, {
      total: prev.total + 1,
      noShows: prev.noShows + (a.status === "no_show" ? 1 : 0),
    });
  }

  return map;
}

/**
 * Extract average response minutes from patient's stored response patterns.
 * Returns null if insufficient data (< 3 records).
 */
function extractAvgResponseMinutes(
  patterns: { readonly records: ReadonlyArray<{ readonly responseMinutes: number }> } | null
): number | null {
  if (!patterns?.records || patterns.records.length < 3) return null;

  const totalMinutes = patterns.records.reduce(
    (sum, r) => sum + r.responseMinutes,
    0
  );
  return Math.round(totalMinutes / patterns.records.length);
}
