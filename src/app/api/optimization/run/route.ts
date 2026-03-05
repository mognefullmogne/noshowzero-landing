// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * POST /api/optimization/run — Manually trigger optimization analysis.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { runOptimization } from "@/lib/optimization/calendar-optimizer";
import { flagHighRiskAppointments } from "@/lib/optimization/proactive-reschedule";
import { logAuditEvent } from "@/lib/audit/log-event";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const supabase = await createClient();

    const [optimizationResult, rescheduleResult] = await Promise.all([
      runOptimization(supabase, auth.data.tenantId),
      flagHighRiskAppointments(supabase, auth.data.tenantId),
    ]);

    logAuditEvent({
      tenantId: auth.data.tenantId,
      actorType: "user",
      actorId: auth.data.userId,
      entityType: "optimization",
      action: "optimization.run",
      metadata: {
        gap_fill_decisions: optimizationResult.decisions,
        proactive_reschedule_flags: rescheduleResult.flagged,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        gap_fill_decisions: optimizationResult.decisions,
        proactive_reschedule_flags: rescheduleResult.flagged,
        errors: optimizationResult.errors,
      },
    });
  } catch (err) {
    console.error("Optimization run error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Optimization run failed" } },
      { status: 500 }
    );
  }
}
