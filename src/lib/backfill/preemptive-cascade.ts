// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Pre-emptive cascade for critical-risk appointments.
 *
 * For appointments with risk_score >= 75 (critical tier), we pre-qualify
 * the top candidates BEFORE the patient actually cancels or times out.
 * This means when the cancellation/timeout does happen, we can immediately
 * contact the first candidate without the delay of searching and ranking.
 *
 * Pre-qualified candidates are stored in the `prequalified_candidates` table
 * (or audit_log for lightweight tracking) and consumed by triggerBackfill.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { findCandidates, type RankedCandidate } from "./find-candidates";

const CRITICAL_RISK_THRESHOLD = 75;
const MAX_PREQUALIFIED = 5;

interface PrequalifyResult {
  readonly appointmentId: string;
  readonly candidateCount: number;
}

/**
 * Pre-qualify candidates for a single critical-risk appointment.
 * Stores the top candidates in audit_log for later retrieval.
 * Does NOT contact candidates — just prepares the ranked list.
 */
export async function prequalifyCandidates(
  supabase: SupabaseClient,
  appointmentId: string,
  tenantId: string
): Promise<PrequalifyResult> {
  // Fetch the appointment details
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !appointment) {
    console.warn("[Preemptive] Appointment not found:", appointmentId);
    return { appointmentId, candidateCount: 0 };
  }

  // Only prequalify for future, active appointments
  if (new Date(appointment.scheduled_at) <= new Date()) {
    return { appointmentId, candidateCount: 0 };
  }

  if (!["scheduled", "reminder_pending", "reminder_sent"].includes(appointment.status)) {
    return { appointmentId, candidateCount: 0 };
  }

  // Find and rank candidates using existing algorithm
  const candidates = await findCandidates(supabase, {
    appointmentId,
    tenantId,
    cancellingPatientId: appointment.patient_id,
    scheduledAt: new Date(appointment.scheduled_at),
    durationMin: appointment.duration_min,
  }, MAX_PREQUALIFIED);

  if (candidates.length === 0) {
    return { appointmentId, candidateCount: 0 };
  }

  // Store prequalified candidates as a lightweight audit log entry.
  // The cascade system can check for these before doing a full search.
  const candidateSnapshot = candidates.map((c) => ({
    candidateAppointmentId: c.candidateAppointmentId,
    patientId: c.patientId,
    patientName: c.patientName,
    score: c.candidateScore.total,
  }));

  // Upsert: remove previous prequalification for this appointment, then insert fresh
  await supabase
    .from("audit_log")
    .delete()
    .eq("entity_id", appointmentId)
    .eq("action", "prequalified_candidates")
    .eq("tenant_id", tenantId);

  await supabase.from("audit_log").insert({
    tenant_id: tenantId,
    actor_type: "system",
    entity_type: "appointment",
    entity_id: appointmentId,
    action: "prequalified_candidates",
    metadata: {
      candidates: candidateSnapshot,
      prequalified_at: new Date().toISOString(),
      risk_score: appointment.risk_score,
    },
  });

  console.info(
    `[Preemptive] Prequalified ${candidates.length} candidates for appointment ${appointmentId} (risk: ${appointment.risk_score})`
  );

  return { appointmentId, candidateCount: candidates.length };
}

/**
 * Run pre-emptive cascade for all critical-risk appointments for a tenant.
 * Called from the run-optimization cron alongside flagHighRiskAppointments.
 */
export async function prequalifyForCriticalRisk(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ prequalified: number }> {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Find critical-risk appointments in the next 7 days
  const { data: criticalAppts } = await supabase
    .from("appointments")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["scheduled", "reminder_pending", "reminder_sent"])
    .gte("risk_score", CRITICAL_RISK_THRESHOLD)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", weekEnd.toISOString())
    .order("risk_score", { ascending: false })
    .limit(20);

  if (!criticalAppts || criticalAppts.length === 0) {
    return { prequalified: 0 };
  }

  let prequalified = 0;

  for (const appt of criticalAppts) {
    // Check if we already prequalified recently (within 6 hours)
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const { data: existing } = await supabase
      .from("audit_log")
      .select("id, metadata")
      .eq("entity_id", appt.id)
      .eq("action", "prequalified_candidates")
      .gte("created_at", sixHoursAgo.toISOString())
      .maybeSingle();

    if (existing) continue; // Already prequalified recently

    const result = await prequalifyCandidates(supabase, appt.id, tenantId);
    if (result.candidateCount > 0) prequalified++;
  }

  return { prequalified };
}

/**
 * Retrieve prequalified candidates for an appointment.
 * Returns the candidate list if available, null otherwise.
 * Called by triggerBackfill to skip the candidate search for critical-risk slots.
 */
export async function getPrequalifiedCandidates(
  supabase: SupabaseClient,
  appointmentId: string,
  tenantId: string
): Promise<readonly RankedCandidate[] | null> {
  const { data: auditEntry } = await supabase
    .from("audit_log")
    .select("metadata")
    .eq("entity_id", appointmentId)
    .eq("action", "prequalified_candidates")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!auditEntry?.metadata) return null;

  const metadata = auditEntry.metadata as {
    candidates?: Array<{
      candidateAppointmentId: string;
      patientId: string;
      patientName: string;
      score: number;
    }>;
    prequalified_at?: string;
  };

  if (!metadata.candidates || metadata.candidates.length === 0) return null;

  // Check staleness — discard if older than 12 hours
  if (metadata.prequalified_at) {
    const age = Date.now() - new Date(metadata.prequalified_at).getTime();
    if (age > 12 * 60 * 60 * 1000) {
      console.info("[Preemptive] Prequalified candidates are stale, discarding");
      return null;
    }
  }

  // Re-fetch full candidate details from the snapshot patient IDs
  // We need to validate they're still eligible (not declined, appointment still active)
  const candidateApptIds = metadata.candidates.map((c) => c.candidateAppointmentId);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, patient:patients(id, first_name, last_name, phone, email, preferred_channel)")
    .in("id", candidateApptIds)
    .in("status", ["scheduled", "reminder_pending", "reminder_sent", "confirmed"]);

  if (!appointments || appointments.length === 0) return null;

  // Rebuild as RankedCandidate, preserving original scores
  const scoreMap = new Map(
    metadata.candidates.map((c) => [c.candidateAppointmentId, c.score])
  );

  const ranked: RankedCandidate[] = appointments
    .map((appt) => {
      const patient = appt.patient as {
        id: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        email: string | null;
        preferred_channel: string;
      } | null;

      if (!patient) return null;

      const totalScore = scoreMap.get(appt.id) ?? 0;

      return {
        candidateAppointmentId: appt.id,
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`,
        patientPhone: patient.phone,
        patientEmail: patient.email,
        preferredChannel: patient.preferred_channel as "whatsapp" | "sms" | "email",
        candidateScore: {
          total: totalScore,
          appointmentDistance: Math.round(totalScore * 0.6),
          reliability: Math.round(totalScore * 0.4),
          urgencyBonus: 0,
          responsiveness: 0,
        },
        currentAppointmentAt: new Date(appt.scheduled_at),
      } satisfies RankedCandidate;
    })
    .filter((c): c is RankedCandidate => c !== null)
    .sort((a, b) => b.candidateScore.total - a.candidateScore.total);

  return ranked.length > 0 ? ranked : null;
}
