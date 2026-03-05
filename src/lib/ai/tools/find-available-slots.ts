// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function findAvailableSlots(
  supabase: SupabaseClient,
  tenantId: string,
  input: Record<string, unknown>
) {
  let query = supabase
    .from("appointment_slots")
    .select("id, provider_name, location_name, service_code, start_at, end_at, status")
    .eq("tenant_id", tenantId)
    .eq("status", "available")
    .gte("start_at", input.from_date as string)
    .lte("start_at", input.to_date as string)
    .order("start_at", { ascending: true })
    .limit(50);

  if (input.provider_name) {
    query = query.ilike("provider_name", `%${input.provider_name}%`);
  }

  const { data, error } = await query;

  if (error) return { error: error.message };

  return {
    count: (data ?? []).length,
    slots: (data ?? []).map((s) => ({
      id: s.id,
      provider: s.provider_name,
      location: s.location_name,
      service: s.service_code,
      start: s.start_at,
      end: s.end_at,
    })),
  };
}
