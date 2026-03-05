// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Find and rank candidate patients for a cancelled appointment slot.
 *
 * Two candidate sources:
 * 1. Appointments table — scheduled patients who could move to an earlier slot
 * 2. Waitlist entries — patients waiting for a slot (status=waiting)
 *
 * Both are scored, merged, deduplicated by patient, and sorted descending.
 *
 * SLOT-01: Appointment-based candidate detection
 * SLOT-02: Candidate scoring and ranking
 * SLOT-03: Waitlist-based candidate detection
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
  readonly serviceName?: string; // for waitlist service matching
  readonly providerName?: string | null; // for waitlist provider matching
}

export interface RankedCandidate {
  readonly candidateAppointmentId: string | null; // null for waitlist-sourced candidates
  readonly waitlistEntryId: string | null; // non-null for waitlist-sourced candidates
  readonly source: "appointment" | "waitlist";
  readonly patientId: string;
  readonly patientName: string;
  readonly patientPhone: string | null;
  readonly patientEmail: string | null;
  readonly preferredChannel: "whatsapp" | "sms" | "email";
  readonly candidateScore: CandidateScoreBreakdown;
  readonly currentAppointmentAt: Date | null; // null for waitlist-sourced candidates
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

  const typedAppointments = (appointments ?? []) as AppointmentRow[];

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

  // --- Appointment-based candidates ---
  let apptCandidates: RankedCandidate[] = [];

  if (filtered.length > 0) {
    const deduped = deduplicateByPatient(filtered);
    const patientIds = deduped.map((a) => a.patient_id);
    const { data: apptStats } = await supabase
      .from("appointments")
      .select("patient_id, status")
      .eq("tenant_id", slot.tenantId)
      .in("patient_id", patientIds);

    const statsMap = buildStatsMap(apptStats ?? []);

    apptCandidates = deduped.map((appt): RankedCandidate | null => {
      const patient = appt.patient;
      if (!patient) return null;

      const stats = statsMap.get(appt.patient_id) ?? { total: 0, noShows: 0 };
      const avgResponseMinutes = extractAvgResponseMinutes(patient.response_patterns);

      const candidateScore = computeCandidateScore({
        appointmentScheduledAt: new Date(appt.scheduled_at),
        openSlotAt: slot.scheduledAt,
        patientNoShows: stats.noShows,
        patientTotal: stats.total,
        now,
        avgResponseMinutes,
      });

      return {
        candidateAppointmentId: appt.id,
        waitlistEntryId: null,
        source: "appointment",
        patientId: appt.patient_id,
        patientName: `${patient.first_name} ${patient.last_name}`,
        patientPhone: patient.phone,
        patientEmail: patient.email,
        preferredChannel: patient.preferred_channel as "whatsapp" | "sms" | "email",
        candidateScore,
        currentAppointmentAt: new Date(appt.scheduled_at),
      };
    }).filter((c): c is RankedCandidate => c !== null);
  }

  // --- Waitlist-based candidates (only if service info available) ---
  let waitlistCandidates: RankedCandidate[] = [];

  if (slot.serviceName) {
    const waitlistQuery = supabase
      .from("waitlist_entries")
      .select("id, patient_id, service_name, preferred_provider, clinical_urgency, smart_score, patient:patients(id, first_name, last_name, phone, email, preferred_channel, response_patterns)")
      .eq("tenant_id", slot.tenantId)
      .eq("status", "waiting")
      .eq("service_name", slot.serviceName)
      .neq("patient_id", slot.cancellingPatientId)
      .limit(50);

    const { data: waitlistEntries } = await waitlistQuery;

    // Fetch no-show stats for waitlist patients
    const waitlistPatientIds = (waitlistEntries ?? [])
      .filter((e) => e.patient && !declinedPatientIds.has(e.patient_id))
      .map((e) => e.patient_id);

    const { data: waitlistStats } = waitlistPatientIds.length > 0
      ? await supabase
          .from("appointments")
          .select("patient_id, status")
          .eq("tenant_id", slot.tenantId)
          .in("patient_id", waitlistPatientIds)
      : { data: [] };

    const waitlistStatsMap = buildStatsMap(waitlistStats ?? []);

    waitlistCandidates = (waitlistEntries ?? [])
      .filter((entry) => {
        if (!entry.patient) return false;
        if (declinedPatientIds.has(entry.patient_id)) return false;
        return true;
      })
      .map((entry) => {
        const patient = entry.patient as unknown as {
          id: string; first_name: string; last_name: string;
          phone: string | null; email: string | null; preferred_channel: string;
          response_patterns: { records: ReadonlyArray<{ responseMinutes: number }> } | null;
        };
        const stats = waitlistStatsMap.get(entry.patient_id) ?? { total: 0, noShows: 0 };
        const avgResponseMinutes = extractAvgResponseMinutes(patient.response_patterns);

        const candidateScore = computeCandidateScore({
          appointmentScheduledAt: null, // waitlist candidate has no existing appointment
          openSlotAt: slot.scheduledAt,
          patientNoShows: stats.noShows,
          patientTotal: stats.total,
          now,
          avgResponseMinutes,
        });

        return {
          candidateAppointmentId: null,
          waitlistEntryId: entry.id,
          source: "waitlist" as const,
          patientId: entry.patient_id,
          patientName: `${patient.first_name} ${patient.last_name}`,
          patientPhone: patient.phone,
          patientEmail: patient.email,
          preferredChannel: patient.preferred_channel as "whatsapp" | "sms" | "email",
          candidateScore,
          currentAppointmentAt: null,
        } satisfies RankedCandidate;
      });
  }

  // --- Merge, deduplicate by patient (appointment-based wins), sort ---
  const seenPatients = new Set<string>();
  const merged: RankedCandidate[] = [];

  // Appointment candidates first (they have real distance scores)
  for (const c of apptCandidates) {
    if (!seenPatients.has(c.patientId)) {
      seenPatients.add(c.patientId);
      merged.push(c);
    }
  }
  for (const c of waitlistCandidates) {
    if (!seenPatients.has(c.patientId)) {
      seenPatients.add(c.patientId);
      merged.push(c);
    }
  }

  merged.sort((a, b) => b.candidateScore.total - a.candidateScore.total);
  return merged.slice(0, limit);
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
