/**
 * Cron: Daily KPI snapshot (runs at 00:15 every day).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeDailySnapshot } from "@/lib/kpi/compute-snapshot";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = await createServiceClient();

  // Compute for yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  // Get all active tenants
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id")
    .in("plan_status", ["active", "trialing"]);

  let computed = 0;
  let errors = 0;

  for (const tenant of tenants ?? []) {
    try {
      const metrics = await computeDailySnapshot(supabase, tenant.id, dateStr);

      const { error } = await supabase.from("kpi_snapshots").upsert(
        {
          tenant_id: tenant.id,
          snapshot_date: dateStr,
          period: "daily",
          metrics,
        },
        { onConflict: "tenant_id,snapshot_date,period" }
      );

      if (error) {
        console.error(`[KPI] Snapshot error for tenant ${tenant.id}:`, error);
        errors++;
      } else {
        computed++;
      }
    } catch (err) {
      console.error(`[KPI] Error for tenant ${tenant.id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ date: dateStr, computed, errors, total: (tenants ?? []).length });
}
