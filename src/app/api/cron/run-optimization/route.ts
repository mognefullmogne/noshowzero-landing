/**
 * Cron: Run optimization (every 6 hours).
 * Runs optimization for all active tenants.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runOptimization } from "@/lib/optimization/calendar-optimizer";
import { flagHighRiskAppointments } from "@/lib/optimization/proactive-reschedule";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Get all active tenants
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id")
    .in("plan_status", ["active", "trialing"]);

  let totalDecisions = 0;
  let totalFlags = 0;

  for (const tenant of tenants ?? []) {
    try {
      const [opt, risk] = await Promise.all([
        runOptimization(supabase, tenant.id),
        flagHighRiskAppointments(supabase, tenant.id),
      ]);
      totalDecisions += opt.decisions;
      totalFlags += risk.flagged;
    } catch (err) {
      console.error(`[Cron] Optimization error for tenant ${tenant.id}:`, err);
    }
  }

  return NextResponse.json({
    tenants: (tenants ?? []).length,
    decisions: totalDecisions,
    risk_flags: totalFlags,
  });
}
