// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Automatic No-Show Detection
 *
 * Finds appointments with status `confirmed` or `scheduled` where the
 * scheduled time is more than 15 minutes in the past, and auto-marks
 * them as `no_show`. For each, triggers the cascade system to attempt
 * to recover the slot (if the slot is still upcoming in a chain).
 *
 * Called from a cron endpoint (detect-no-shows) every 15 minutes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";
import { dispatchWebhookEvent } from "@/lib/webhooks/outbound";

/** Appointments are considered no-show after this many minutes past their start. */
const NOSHOW_THRESHOLD_MINUTES = 15;

/** Max appointments to process per cron run to avoid timeout. */
const BATCH_LIMIT = 50;

export interface DetectNoShowsResult {
  readonly detected: number;
  readonly cascaded: number;
  readonly errors: number;
}

/**
 * Scan for overdue appointments and mark them as no-shows.
 * Triggers cascade backfill for each detected no-show.
 */
export async function detectNoShows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<DetectNoShowsResult> {
  const cutoff = new Date(Date.now() - NOSHOW_THRESHOLD_MINUTES * 60_000);

  // Find overdue appointments: confirmed/scheduled with start time > 15 min ago
  const { data: overdueAppts, error } = await supabase
    .from("appointments")
    .select("id, tenant_id, patient_id, scheduled_at")
    .eq("tenant_id", tenantId)
    .in("status", ["confirmed", "scheduled"])
    .lt("scheduled_at", cutoff.toISOString())
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("[NoShowDetector] Query error:", error);
    return { detected: 0, cascaded: 0, errors: 1 };
  }

  if (!overdueAppts || overdueAppts.length === 0) {
    return { detected: 0, cascaded: 0, errors: 0 };
  }

  let detected = 0;
  let cascaded = 0;
  let errors = 0;

  for (const appt of overdueAppts) {
    // Atomically mark as no_show (WHERE status guard prevents double-marking)
    const { error: updateError, data: updated } = await supabase
      .from("appointments")
      .update({
        status: "no_show",
        notes: `Auto-detected no-show: appointment was ${NOSHOW_THRESHOLD_MINUTES}+ minutes overdue`,
      })
      .eq("id", appt.id)
      .eq("tenant_id", tenantId)
      .in("status", ["confirmed", "scheduled"])
      .select("id");

    if (updateError) {
      console.error("[NoShowDetector] Update error for appointment:", appt.id, updateError);
      errors++;
      continue;
    }

    if (!updated || updated.length === 0) {
      // Already updated by another process — skip
      continue;
    }

    detected++;

    // Log to audit
    await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      actor_type: "system",
      entity_type: "appointment",
      entity_id: appt.id,
      action: "auto_noshow_detected",
      metadata: {
        scheduled_at: appt.scheduled_at,
        detected_at: new Date().toISOString(),
        minutes_overdue: Math.round(
          (Date.now() - new Date(appt.scheduled_at).getTime()) / 60_000
        ),
      },
    });

    // Dispatch webhook for no-show detected
    try {
      await dispatchWebhookEvent(tenantId, "appointment.no_show", {
        appointment_id: appt.id,
        patient_id: appt.patient_id,
        scheduled_at: appt.scheduled_at,
        detected_at: new Date().toISOString(),
      });
    } catch { /* webhook delivery is best-effort */ }

    // Trigger cascade — the slot may be recoverable if it is part of a
    // same-day schedule where later candidates could still benefit
    try {
      const offerId = await triggerBackfill(supabase, appt.id, tenantId, { triggerEvent: "no_show" });
      if (offerId) cascaded++;
    } catch (err) {
      console.error("[NoShowDetector] Cascade error for appointment:", appt.id, err);
      errors++;
    }
  }

  console.info(
    `[NoShowDetector] tenant=${tenantId.slice(0, 8)}... detected=${detected} cascaded=${cascaded} errors=${errors}`
  );

  return { detected, cascaded, errors };
}

/**
 * Scan ALL tenants for no-shows.
 * Used by the cron endpoint to process all tenants in one batch.
 */
export async function detectNoShowsAllTenants(
  supabase: SupabaseClient
): Promise<DetectNoShowsResult> {
  const cutoff = new Date(Date.now() - NOSHOW_THRESHOLD_MINUTES * 60_000);

  // Find distinct tenant IDs with overdue appointments
  const { data: tenantRows, error } = await supabase
    .from("appointments")
    .select("tenant_id")
    .in("status", ["confirmed", "scheduled"])
    .lt("scheduled_at", cutoff.toISOString())
    .limit(200);

  if (error || !tenantRows || tenantRows.length === 0) {
    if (error) console.error("[NoShowDetector] Tenant query error:", error);
    return { detected: 0, cascaded: 0, errors: 0 };
  }

  // Deduplicate tenant IDs
  const tenantIds = [...new Set(tenantRows.map((r) => r.tenant_id))];

  let totalDetected = 0;
  let totalCascaded = 0;
  let totalErrors = 0;

  for (const tenantId of tenantIds) {
    const result = await detectNoShows(supabase, tenantId);
    totalDetected += result.detected;
    totalCascaded += result.cascaded;
    totalErrors += result.errors;
  }

  return { detected: totalDetected, cascaded: totalCascaded, errors: totalErrors };
}
