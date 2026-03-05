// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/integrations/outlook/calendars
 * List available Outlook calendars after connecting.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { listOutlookCalendars } from "@/lib/integrations/outlook-calendar";
import { ensureValidOutlookToken } from "@/lib/integrations/token-refresh";

export async function GET() {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { tenantId } = auth.data;

  const { data: integration } = await supabase
    .from("calendar_integrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("provider", "outlook")
    .maybeSingle();

  if (!integration?.access_token_enc) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_CONNECTED", message: "Outlook Calendar not connected" } },
      { status: 404 }
    );
  }

  try {
    const accessToken = await ensureValidOutlookToken(supabase, integration);
    const calendars = await listOutlookCalendars(accessToken);

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
