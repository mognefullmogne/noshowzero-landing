/**
 * Find expired pending offers and cascade to next candidate.
 * Called by the cron endpoint every 15 minutes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { triggerBackfill } from "./trigger-backfill";

interface ExpireResult {
  readonly expired: number;
  readonly cascaded: number;
}

export async function expirePendingOffers(supabase: SupabaseClient): Promise<ExpireResult> {
  const now = new Date().toISOString();

  // Find all expired pending offers
  const { data: expiredOffers, error } = await supabase
    .from("waitlist_offers")
    .select("id, original_appointment_id, tenant_id")
    .eq("status", "pending")
    .lte("expires_at", now)
    .limit(50);

  if (error || !expiredOffers || expiredOffers.length === 0) {
    if (error) console.error("[Backfill] Failed to query expired offers:", error);
    return { expired: 0, cascaded: 0 };
  }

  let expired = 0;
  let cascaded = 0;

  for (const offer of expiredOffers) {
    // Mark as expired
    const { error: updateError } = await supabase
      .from("waitlist_offers")
      .update({ status: "expired", responded_at: now })
      .eq("id", offer.id)
      .eq("status", "pending"); // Guard against race condition

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
