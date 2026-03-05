// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/integrations/google/calendars
 * List available Google calendars after connecting.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { listGoogleCalendars } from "@/lib/integrations/google-calendar";
import { ensureValidGoogleToken } from "@/lib/integrations/token-refresh";

export async function GET() {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { tenantId } = auth.data;

  const { data: integration } = await supabase
    .from("calendar_integrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("provider", "google")
    .maybeSingle();

  if (!integration?.access_token_enc) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_CONNECTED", message: "Google Calendar not connected" } },
      { status: 404 }
    );
  }

  try {
    const accessToken = await ensureValidGoogleToken(supabase, integration);
    const calendars = await listGoogleCalendars(accessToken);

    return NextResponse.json({
      success: true,
      data: { calendars, selectedIds: integration.calendar_ids ?? [] },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list calendars";
    return NextResponse.json(
      { success: false, error: { code: "API_ERROR", message } },
      { status: 502 }
    );
  }
}
