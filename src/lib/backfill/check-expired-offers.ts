/**
 * Lightweight utility to expire pending offers and cascade to next candidates.
 * Can be called from:
 *   - The expire-offers cron (all tenants)
 *   - The Twilio webhook handler (single tenant, opportunistic/event-driven)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { triggerBackfill } from "./trigger-backfill";

interface CheckExpiredResult {
  readonly expired: number;
  readonly cascaded: number;
}

/**
 * Expire pending offers past their expires_at and cascade to next candidates.
 * Optionally scoped to a single tenant (for event-driven calls from the webhook).
 */
export async function checkExpiredOffers(
  supabase: SupabaseClient,
  tenantId?: string
): Promise<CheckExpiredResult> {
  const now = new Date().toISOString();

  // Build query — optionally scoped to a single tenant
  let query = supabase
    .from("waitlist_offers")
    .select("id, original_appointment_id, tenant_id")
    .eq("status", "pending")
    .lte("expires_at", now)
    .limit(50);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data: expiredOffers, error } = await query;

  if (error || !expiredOffers || expiredOffers.length === 0) {
    if (error) console.error("[Backfill] Failed to query expired offers:", error);
    return { expired: 0, cascaded: 0 };
  }

  let expired = 0;
  let cascaded = 0;

  for (const offer of expiredOffers) {
    // Atomically mark as expired — guard against race conditions
    const { error: updateError } = await supabase
      .from("waitlist_offers")
      .update({ status: "expired", responded_at: now })
      .eq("id", offer.id)
      .eq("status", "pending");

    if (updateError) {
      console.error("[Backfill] Failed to expire offer:", offer.id, updateError);
      continue;
    }
    expired++;

    // Cascade: try next candidate for this slot
    const offerId = await triggerBackfill(
      supabase,
      offer.original_appointment_id,
      offer.tenant_id
    );
    if (offerId) cascaded++;
  }

  return { expired, cascaded };
}
