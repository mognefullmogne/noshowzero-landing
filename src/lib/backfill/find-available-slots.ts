// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Find available backfill slots — cancelled appointments that haven't been
 * filled by another patient or active offer.
 *
 * Used when a patient joins the waitlist to immediately offer open slots.
 * Backfill slots are prioritized over calendar gaps because they represent
 * previously scheduled time (higher value to the practice).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_LEAD_TIME_MS = 2 * 3_600_000; // 2 hours
const TENANT_TIMEZONE = "Europe/Rome";

export interface AvailableBackfillSlot {
  readonly appointmentId: string;
  readonly scheduledAt: string;
  readonly durationMin: number;
  readonly serviceName: string;
  readonly providerName: string | null;
  readonly locationName: string | null;
  readonly dayLabel: string;
  readonly timeLabel: string;
}

/**
 * Find cancelled appointments that are still available for backfill.
 *
 * Filters:
 * - Status: cancelled, no_show, or timeout
 * - At least 2 hours in the future
 * - No active (pending/accepted) offer exists
 * - No replacement appointment at the same time
 * - Optional: match service_name
 */
export async function findAvailableBackfillSlots(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { readonly serviceName?: string; readonly limit?: number }
): Promise<readonly AvailableBackfillSlot[]> {
  const now = new Date();
  const minTime = new Date(now.getTime() + MIN_LEAD_TIME_MS);
  const limit = options?.limit ?? 5;

  // Fetch cancelled appointments in the future
  let query = supabase
    .from("appointments")
    .select("id, scheduled_at, duration_min, service_name, provider_name, location_name")
    .eq("tenant_id", tenantId)
    .in("status", ["cancelled", "no_show", "timeout"])
    .gte("scheduled_at", minTime.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit * 3); // fetch extra for post-filtering

  if (options?.serviceName) {
    query = query.eq("service_name", options.serviceName);
  }

  const { data: cancelledAppts, error } = await query;
  if (error || !cancelledAppts || cancelledAppts.length === 0) {
    return [];
  }

  // Filter out appointments that already have active offers
  const apptIds = cancelledAppts.map((a) => a.id);
  const { data: activeOffers } = await supabase
    .from("waitlist_offers")
    .select("original_appointment_id")
    .in("original_appointment_id", apptIds)
    .in("status", ["pending", "accepted"]);

  const blockedIds = new Set(
    (activeOffers ?? []).map((o: { original_appointment_id: string }) => o.original_appointment_id)
  );

  const unblockedAppts = cancelledAppts.filter((a) => !blockedIds.has(a.id));

  // For each potential slot, verify no active appointment exists at the same time
  const finalSlots: AvailableBackfillSlot[] = [];

  for (const appt of unblockedAppts) {
    if (finalSlots.length >= limit) break;

    const { data: existing } = await supabase
      .from("appointments")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("scheduled_at", appt.scheduled_at)
      .not("status", "in", "(cancelled,declined,no_show,timeout)")
      .limit(1);

    if (existing && existing.length > 0) continue; // slot already filled

    const date = new Date(appt.scheduled_at);
    finalSlots.push({
      appointmentId: appt.id,
      scheduledAt: appt.scheduled_at,
      durationMin: appt.duration_min ?? 30,
      serviceName: appt.service_name ?? "Visita",
      providerName: appt.provider_name ?? null,
      locationName: appt.location_name ?? null,
      dayLabel: date.toLocaleDateString("it-IT", {
        timeZone: TENANT_TIMEZONE,
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      timeLabel: date.toLocaleTimeString("it-IT", {
        timeZone: TENANT_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  return finalSlots;
}
