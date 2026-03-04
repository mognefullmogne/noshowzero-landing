/**
 * Orchestrator: given a cancelled appointment, find the best candidate and send them an offer.
 * This is called from:
 *   - Appointment PATCH (on cancellation/no-show)
 *   - Decline flow (cascade to next candidate)
 *   - Expire offers cron (cascade after timeout)
 *   - Escalation timeout (multi-touch exhaustion)
 *
 * Supports:
 *   - Pre-emptive cascade: uses prequalified candidates when available
 *   - Time-aware speed: parallel outreach and variable expiry based on slot urgency
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { findCandidates } from "./find-candidates";
import { sendOffer } from "./send-offer";
import { getPrequalifiedCandidates } from "./preemptive-cascade";
import { getTimeAwareConfig } from "./time-aware-config";

/** Maximum offers per slot to prevent runaway cascades. */
const MAX_OFFERS_PER_SLOT = 10;

interface TriggerBackfillOptions {
  /** Override parallel count (for testing or manual triggers). */
  readonly parallelCount?: number;
}

/**
 * Find the best waitlist candidate for a cancelled slot and send them an offer.
 * Returns the offer ID(s) if successful, null if no candidates found or send failed.
 */
export async function triggerBackfill(
  supabase: SupabaseClient,
  appointmentId: string,
  tenantId: string,
  options?: TriggerBackfillOptions
): Promise<string | null> {
  // Fetch the cancelled appointment details
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !appointment) {
    console.error("[Backfill] Appointment not found:", appointmentId);
    return null;
  }

  // Only backfill for cancelled/no_show appointments with future slots
  if (!["cancelled", "no_show"].includes(appointment.status)) {
    console.warn("[Backfill] Appointment is not cancelled/no_show:", appointment.status);
    return null;
  }

  const scheduledAt = new Date(appointment.scheduled_at);
  if (scheduledAt <= new Date()) {
    console.warn("[Backfill] Appointment slot is in the past — skipping");
    return null;
  }

  // Check if there's already a pending or accepted offer for this slot
  const { data: existingOffers } = await supabase
    .from("waitlist_offers")
    .select("id")
    .eq("original_appointment_id", appointmentId)
    .in("status", ["pending", "accepted"])
    .limit(1);

  if (existingOffers && existingOffers.length > 0) {
    console.info("[Backfill] Active offer already exists for appointment:", appointmentId);
    return null;
  }

  // Guard: cap total offers per slot to prevent runaway cascades
  const { count: totalOffers } = await supabase
    .from("waitlist_offers")
    .select("id", { count: "exact", head: true })
    .eq("original_appointment_id", appointmentId)
    .in("status", ["pending", "accepted", "declined", "expired"]);

  if (totalOffers !== null && totalOffers >= MAX_OFFERS_PER_SLOT) {
    console.warn(
      "[Backfill] MAX_OFFERS_PER_SLOT reached for appointment:",
      appointmentId,
      `(${totalOffers}/${MAX_OFFERS_PER_SLOT})`
    );
    return null;
  }

  // Determine time-aware cascade configuration
  const timeConfig = getTimeAwareConfig(scheduledAt);

  // Try prequalified candidates first (from pre-emptive cascade)
  let candidates = await getPrequalifiedCandidates(supabase, appointmentId, tenantId);

  // Fall back to live candidate search if no prequalified candidates
  if (!candidates || candidates.length === 0) {
    candidates = await findCandidates(supabase, {
      appointmentId,
      tenantId,
      cancellingPatientId: appointment.patient_id,
      scheduledAt,
      durationMin: appointment.duration_min,
    });
  } else {
    console.info(
      `[Backfill] Using ${candidates.length} prequalified candidates for appointment ${appointmentId}`
    );
  }

  if (candidates.length === 0) {
    // Check if any offers were previously sent — if so, cascade is exhausted
    const { count: previousOffers } = await supabase
      .from("waitlist_offers")
      .select("id", { count: "exact", head: true })
      .eq("original_appointment_id", appointmentId);

    if (previousOffers && previousOffers > 0) {
      console.warn(
        "[Backfill] CASCADE EXHAUSTED: No more candidates for appointment:",
        appointmentId,
        `(${previousOffers} offers sent)`
      );

      // Record cascade exhaustion in audit_log for dashboard visibility
      await supabase.from("audit_log").insert({
        tenant_id: tenantId,
        actor_type: "system",
        entity_type: "appointment",
        entity_id: appointmentId,
        action: "cascade_exhausted",
        metadata: { offers_sent: previousOffers },
      });
    } else {
      console.info("[Backfill] No matching candidates for appointment:", appointmentId);
    }

    return null;
  }

  // Determine how many candidates to contact in parallel
  const parallelCount = options?.parallelCount ?? timeConfig.parallelCount;
  const candidatesToContact = candidates.slice(0, parallelCount);

  // Send offer(s) — parallel when urgency demands it
  const offerPromises = candidatesToContact.map((candidate) =>
    sendOffer(supabase, {
      candidate,
      originalAppointmentId: appointmentId,
      tenantId,
      serviceName: appointment.service_name,
      providerName: appointment.provider_name,
      locationName: appointment.location_name,
      scheduledAt,
      expiryMinutes: timeConfig.expiryMinutes,
      urgencyPrefix: timeConfig.urgencyPrefix,
    })
  );

  const results = await Promise.all(offerPromises);

  // Return the first successful offer ID
  const successfulOffer = results.find((r) => r.status === "sent");

  if (!successfulOffer) {
    console.error("[Backfill] All offer sends failed for appointment:", appointmentId);
    return null;
  }

  if (parallelCount > 1) {
    const sentCount = results.filter((r) => r.status === "sent").length;
    console.info(
      `[Backfill] Parallel outreach: ${sentCount}/${parallelCount} offers sent for appointment ${appointmentId} (${timeConfig.tier})`
    );
  }

  return successfulOffer.offerId;
}
