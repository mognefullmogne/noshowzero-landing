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
import { aiRerankCandidates } from "@/lib/scoring/ai-candidate-ranker";
import { decideStrategy, type TriggerEvent } from "@/lib/ai/decision-engine";
import { generateRebookingSuggestions } from "@/lib/ai/smart-rebook";
import { sendNotification } from "@/lib/twilio/send-notification";

/** Maximum offers per slot to prevent runaway cascades. */
const MAX_OFFERS_PER_SLOT = 10;

interface TriggerBackfillOptions {
  /** Override parallel count (for testing or manual triggers). */
  readonly parallelCount?: number;
  /** The event that caused this backfill. Informs AI strategy. */
  readonly triggerEvent?: TriggerEvent;
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

  // Only backfill for cancelled/no_show/timeout appointments with future slots
  if (!["cancelled", "no_show", "timeout"].includes(appointment.status)) {
    console.warn("[Backfill] Appointment is not cancelled/no_show/timeout:", appointment.status);
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

      // Record cascade exhaustion in audit_events for dashboard visibility
      await supabase.from("audit_events").insert({
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

  // AI re-ranking: only runs if ANTHROPIC_API_KEY is set and 3+ candidates
  if (process.env.ANTHROPIC_API_KEY && candidates.length >= 3) {
    try {
      const rerankResult = await aiRerankCandidates(
        candidates,
        {
          scheduledAt,
          serviceName: appointment.service_name,
          providerName: appointment.provider_name,
          locationName: appointment.location_name,
          durationMin: appointment.duration_min,
        },
        { tenantId }
      );

      if (rerankResult.aiReranked) {
        candidates = rerankResult.candidates;
        console.info(
          `[Backfill] AI re-ranked ${candidates.length} candidates for appointment ${appointmentId}`
        );
      }
    } catch (err) {
      // AI failure is non-fatal — continue with math ranking
      console.warn("[Backfill] AI rerank failed, using math ranking:", err);
    }
  }

  // --- AI Decision Engine: strategic reasoning about optimal approach ---
  const triggerEvent: TriggerEvent = options?.triggerEvent ?? inferTriggerEvent(appointment.status);
  let strategy;
  try {
    strategy = await decideStrategy(supabase, appointmentId, tenantId, triggerEvent, candidates);
  } catch (err) {
    console.warn("[Backfill] Decision engine failed, using time-aware defaults:", err);
    strategy = null;
  }

  // If AI says "rebook_first", try rebooking the cancelling patient before cascading
  if (strategy?.rebookCancellingPatient && strategy.strategy === "rebook_first") {
    try {
      const patientPhone = await getPatientPhone(supabase, appointment.patient_id);
      if (patientPhone) {
        const rebook = await generateRebookingSuggestions(supabase, tenantId, appointment.patient_id, {
          id: appointmentId,
          service_name: appointment.service_name,
          provider_name: appointment.provider_name,
          location_name: appointment.location_name,
          scheduled_at: appointment.scheduled_at,
          duration_min: appointment.duration_min,
        });
        // Fire-and-forget rebooking message
        sendNotification({
          to: patientPhone,
          body: rebook.message,
          channel: "whatsapp",
          tenantId,
        }).catch((err) => console.warn("[Backfill] Rebook notification failed:", err));
        console.info(`[Backfill] AI: rebook_first — sent rebooking suggestion to cancelling patient`);
      }
    } catch (err) {
      console.warn("[Backfill] Rebooking attempt failed, continuing cascade:", err);
    }
  }

  // If AI says "wait_and_cascade", skip sending offers now (cron will pick it up later)
  if (strategy?.strategy === "wait_and_cascade") {
    console.info(
      `[Backfill] AI: wait_and_cascade for ${appointmentId} — ${strategy.reasoning}`
    );
    // Record the decision for audit trail
    await supabase.from("audit_events").insert({
      tenant_id: tenantId,
      actor_type: "system",
      entity_type: "appointment",
      entity_id: appointmentId,
      action: "cascade_deferred",
      metadata: {
        strategy: strategy.strategy,
        reasoning: strategy.reasoning,
        ai_generated: strategy.aiGenerated,
        hours_until_slot: (scheduledAt.getTime() - Date.now()) / (60 * 60 * 1000),
      },
    });
    return null;
  }

  // If AI says "manual_review", flag it and don't auto-cascade
  if (strategy?.strategy === "manual_review") {
    console.info(
      `[Backfill] AI: manual_review for ${appointmentId} — ${strategy.reasoning}`
    );
    await supabase.from("audit_events").insert({
      tenant_id: tenantId,
      actor_type: "system",
      entity_type: "appointment",
      entity_id: appointmentId,
      action: "cascade_manual_review",
      metadata: {
        strategy: strategy.strategy,
        reasoning: strategy.reasoning,
        ai_generated: strategy.aiGenerated,
        candidates_available: candidates.length,
      },
    });
    return null;
  }

  // Apply AI strategy parameters (or fall back to time-aware defaults)
  const parallelCount = options?.parallelCount
    ?? strategy?.parallelCount
    ?? timeConfig.parallelCount;
  const expiryMinutes = strategy?.expiryMinutes ?? timeConfig.expiryMinutes;
  const urgencyPrefix = strategy?.urgencyPrefix ?? timeConfig.urgencyPrefix;

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
      expiryMinutes,
      urgencyPrefix,
    })
  );

  const results = await Promise.all(offerPromises);

  // Log AI decision in audit trail
  if (strategy?.aiGenerated) {
    await supabase.from("audit_events").insert({
      tenant_id: tenantId,
      actor_type: "system",
      entity_type: "appointment",
      entity_id: appointmentId,
      action: "ai_strategy_applied",
      metadata: {
        strategy: strategy.strategy,
        reasoning: strategy.reasoning,
        parallel_count: parallelCount,
        expiry_minutes: expiryMinutes,
        rebook_sent: strategy.rebookCancellingPatient,
      },
    });
  }

  // Return the first successful offer ID
  const successfulOffer = results.find((r) => r.status === "sent");

  if (!successfulOffer) {
    console.error("[Backfill] All offer sends failed for appointment:", appointmentId);
    return null;
  }

  if (parallelCount > 1) {
    const sentCount = results.filter((r) => r.status === "sent").length;
    console.info(
      `[Backfill] Parallel outreach: ${sentCount}/${parallelCount} offers sent for appointment ${appointmentId} (${strategy?.strategy ?? timeConfig.tier})`
    );
  }

  return successfulOffer.offerId;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferTriggerEvent(status: string): TriggerEvent {
  if (status === "cancelled") return "cancellation";
  if (status === "no_show") return "no_show";
  return "timeout";
}

async function getPatientPhone(
  supabase: SupabaseClient,
  patientId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("patients")
    .select("phone")
    .eq("id", patientId)
    .maybeSingle();
  return data?.phone ?? null;
}
