// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Cron: Check confirmation timeouts (every 10 min).
 * Picks up workflows in any escalation state past their deadline and marks them timed_out.
 * Triggers backfill for timed-out appointments.
 *
 * Note: The escalate-confirmations cron handles the normal multi-touch flow.
 * This cron is a safety net that catches any workflow past its deadline,
 * regardless of which escalation state it's in.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { markTimedOut } from "@/lib/confirmation/workflow";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  // Fetch workflows that have timed out in any active escalation state
  const { data: workflows, error } = await supabase
    .from("confirmation_workflows")
    .select("id, tenant_id, appointment_id")
    .in("state", ["message_sent", "reminder_sent", "final_warning_sent"])
    .lte("deadline_at", now)
    .limit(50);

  if (error) {
    console.error("[Cron] check-timeouts query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let timedOut = 0;
  let backfilled = 0;

  for (const wf of workflows ?? []) {
    const success = await markTimedOut(supabase, wf.id);
    if (!success) continue;

    timedOut++;

    // Update appointment status to timeout
    await supabase
      .from("appointments")
      .update({ status: "timeout" })
      .eq("id", wf.appointment_id)
      .eq("tenant_id", wf.tenant_id)
      .in("status", ["scheduled", "reminder_sent", "reminder_pending"]);

    // Trigger backfill for the timed-out appointment
    try {
      const result = await triggerBackfill(supabase, wf.appointment_id, wf.tenant_id);
      if (result) backfilled++;
    } catch (err) {
      console.error("[Cron] backfill trigger error:", err);
    }
  }

  return NextResponse.json({ timedOut, backfilled, total: (workflows ?? []).length });
}
