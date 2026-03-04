/**
 * Cron: Run optimization (every 6 hours).
 * Runs optimization for all active tenants.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runOptimization } from "@/lib/optimization/calendar-optimizer";
import { flagHighRiskAppointments } from "@/lib/optimization/proactive-reschedule";
import { prequalifyForCriticalRisk } from "@/lib/backfill/preemptive-cascade";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = await createServiceClient();

  // Get all active tenants
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id")
    .in("plan_status", ["active", "trialing"]);

  let totalDecisions = 0;
  let totalFlags = 0;
  let totalPrequalified = 0;

  for (const tenant of tenants ?? []) {
    try {
      const [opt, risk, preq] = await Promise.all([
        runOptimization(supabase, tenant.id),
        flagHighRiskAppointments(supabase, tenant.id),
        prequalifyForCriticalRisk(supabase, tenant.id),
      ]);
      totalDecisions += opt.decisions;
      totalFlags += risk.flagged;
      totalPrequalified += preq.prequalified;
    } catch (err) {
      console.error(`[Cron] Optimization error for tenant ${tenant.id}:`, err);
    }
  }

  return NextResponse.json({
    tenants: (tenants ?? []).length,
    decisions: totalDecisions,
    risk_flags: totalFlags,
    prequalified: totalPrequalified,
  });
}
