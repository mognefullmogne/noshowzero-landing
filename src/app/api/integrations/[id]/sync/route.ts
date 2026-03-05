// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * POST /api/integrations/[id]/sync
 * Trigger manual sync for a specific integration.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { syncIntegration } from "@/lib/integrations/sync-engine";

const SYNC_COOLDOWN_MS = 60 * 1000; // 60 seconds

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createClient();

  const { data: integration } = await supabase
    .from("calendar_integrations")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.data.tenantId)
    .maybeSingle();

  if (!integration) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Integration not found" } },
      { status: 404 }
    );
  }

  // Rate limit: enforce cooldown between syncs
  if (integration.last_sync_at) {
    const elapsed = Date.now() - new Date(integration.last_sync_at).getTime();
    if (elapsed < SYNC_COOLDOWN_MS) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: "Attendere almeno 60 secondi tra le sincronizzazioni" } },
        { status: 429 }
      );
    }
  }

  if (integration.provider === "csv") {
    return NextResponse.json(
      { success: false, error: { code: "NOT_SYNCABLE", message: "CSV imports cannot be synced. Upload a new file instead." } },
      { status: 400 }
    );
  }

  try {
    const result = await syncIntegration(supabase, integration);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json(
      { success: false, error: { code: "SYNC_FAILED", message } },
      { status: 500 }
    );
  }
}
