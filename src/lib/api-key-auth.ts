// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

interface TenantFromKey {
  readonly tenantId: string;
  readonly keyId: string;
}

/**
 * Authenticate a request using the X-API-Key header.
 * Hashes the provided key and looks it up in the api_keys table.
 * Returns the tenant ID if valid, null otherwise.
 */
export async function authenticateApiKey(
  request: Request
): Promise<TenantFromKey | null> {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || !apiKey.startsWith("nows_")) {
    return null;
  }

  const hash = createHash("sha256").update(apiKey).digest("hex");
  const supabase = await createServiceClient();

  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("id, tenant_id, is_active")
    .eq("key_hash", hash)
    .maybeSingle();

  if (!keyRow || !keyRow.is_active) {
    return null;
  }

  return { tenantId: keyRow.tenant_id, keyId: keyRow.id };
}
