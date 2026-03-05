// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Resolve tenant from a Twilio phone number.
 * Used when an unknown caller sends a message — we determine which
 * clinic/tenant owns the Twilio number they messaged.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Look up which tenant owns the given Twilio phone number.
 * Returns tenant_id or null if not found / not active.
 */
export async function resolveTenantFromPhone(
  supabase: SupabaseClient,
  toNumber: string
): Promise<string | null> {
  // Normalize: strip "whatsapp:" prefix if present
  const normalized = toNumber.replace(/^whatsapp:/, "");

  const { data, error } = await supabase
    .from("tenant_phone_numbers")
    .select("tenant_id")
    .eq("phone_number", normalized)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[TenantResolver] resolveTenantFromPhone error:", error);
    return null;
  }

  return data?.tenant_id ?? null;
}
