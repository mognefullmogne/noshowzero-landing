// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface AuthenticatedTenant {
  readonly tenantId: string;
  readonly userId: string;
}

/**
 * Get the authenticated user's tenant ID from the session.
 * Returns the tenant info or a NextResponse error to send back.
 */
export async function getAuthenticatedTenant(): Promise<
  | { ok: true; data: AuthenticatedTenant }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      ),
    };
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!tenant) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: "NO_TENANT", message: "No tenant found. Complete onboarding first." } },
        { status: 404 }
      ),
    };
  }

  return { ok: true, data: { tenantId: tenant.id, userId: user.id } };
}
