/**
 * Find expired pending offers and cascade to next candidate.
 * Called by the cron endpoint every 30 minutes.
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
    .select("id, waitlist_entry_id, original_appointment_id, tenant_id")
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

    // Reset waitlist entry if offers remain
    const { data: entry } = await supabase
      .from("waitlist_entries")
      .select("offers_sent, max_offers")
      .eq("id", offer.waitlist_entry_id)
      .single();

    if (entry && entry.offers_sent < entry.max_offers) {
      await supabase
        .from("waitlist_entries")
        .update({ status: "waiting" })
        .eq("id", offer.waitlist_entry_id);
    } else if (entry) {
      await supabase
        .from("waitlist_entries")
        .update({ status: "offer_timeout" })
        .eq("id", offer.waitlist_entry_id);
    }

    // Cascade: try next candidate
    const offerId = await triggerBackfill(
      supabase,
      offer.original_appointment_id,
      offer.tenant_id
    );
    if (offerId) cascaded++;
  }

  return { expired, cascaded };
}
