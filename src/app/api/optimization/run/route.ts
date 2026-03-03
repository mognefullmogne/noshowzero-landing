/**
 * POST /api/optimization/run — Manually trigger optimization analysis.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { runOptimization } from "@/lib/optimization/calendar-optimizer";
import { flagHighRiskAppointments } from "@/lib/optimization/proactive-reschedule";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();

  const [optimizationResult, rescheduleResult] = await Promise.all([
    runOptimization(supabase, auth.data.tenantId),
    flagHighRiskAppointments(supabase, auth.data.tenantId),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      gap_fill_decisions: optimizationResult.decisions,
      proactive_reschedule_flags: rescheduleResult.flagged,
      errors: optimizationResult.errors,
    },
  });
}
