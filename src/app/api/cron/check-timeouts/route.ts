/**
 * Cron: Check confirmation timeouts (every 10 min).
 * Picks up message_sent workflows past their deadline and marks them timed_out.
 * Triggers backfill for timed-out appointments.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { markTimedOut } from "@/lib/confirmation/workflow";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  // Fetch workflows that have timed out
  const { data: workflows, error } = await supabase
    .from("confirmation_workflows")
    .select("id, tenant_id, appointment_id")
    .eq("state", "message_sent")
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
