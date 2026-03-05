// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/cron/sync-calendars
 * Cron endpoint — syncs all active integrations across all tenants.
 * Protected with CRON_SECRET header.
 * Designed for Vercel Cron (every 15 min) or external cron services.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { syncIntegration } from "@/lib/integrations/sync-engine";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = await createServiceClient();

  // Fetch all active, syncable integrations
  const { data: integrations, error } = await supabase
    .from("calendar_integrations")
    .select("*")
    .eq("status", "active")
    .neq("provider", "csv");

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: error.message } },
      { status: 500 }
    );
  }

  if (!integrations?.length) {
    return NextResponse.json({
      success: true,
      data: { synced: 0, failed: 0 },
    });
  }

  let synced = 0;
  let failed = 0;

  for (const integration of integrations) {
    try {
      await syncIntegration(supabase, integration);
      synced++;
    } catch (err) {
      failed++;
      console.error(
        `[CronSync] Failed ${integration.provider} for tenant ${integration.tenant_id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return NextResponse.json({
    success: true,
    data: { synced, failed, total: integrations.length },
  });
}
