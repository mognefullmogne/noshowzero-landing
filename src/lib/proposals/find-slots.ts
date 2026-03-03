/**
 * Find the 3 best alternative slots for a patient.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProposedSlotOption } from "@/lib/types";

export async function findBestAlternativeSlots(
  supabase: SupabaseClient,
  tenantId: string,
  serviceName: string,
  providerName?: string | null
): Promise<ProposedSlotOption[]> {
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  let query = supabase
    .from("appointment_slots")
    .select("id, provider_name, start_at, end_at")
    .eq("tenant_id", tenantId)
    .eq("status", "available")
    .gte("start_at", now.toISOString())
    .lte("start_at", twoWeeksOut.toISOString())
    .order("start_at", { ascending: true })
    .limit(20);

  if (providerName) {
    query = query.eq("provider_name", providerName);
  }

  const { data: slots } = await query;
  if (!slots || slots.length === 0) return [];

  // Return top 3
  return slots.slice(0, 3).map((s, i) => ({
    index: i + 1,
    slot_id: s.id,
    start_at: s.start_at,
    end_at: s.end_at,
    provider_name: s.provider_name,
  }));
}
