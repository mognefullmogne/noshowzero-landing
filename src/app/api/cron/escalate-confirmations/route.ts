/**
 * Cron: Escalate confirmation workflows through multi-touch ladder.
 * Runs every 15 minutes to check for workflows needing escalation.
 *
 * Touch 2 (SMS reminder): message_sent workflows where appointment is within 24h
 * Touch 3 (Final warning): reminder_sent workflows where appointment is within 6h
 * Timeout: final_warning_sent workflows past 2h deadline -> cascade
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runEscalation } from "@/lib/confirmation/escalation";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();
    const result = await runEscalation(supabase);

    console.info(
      `[Cron] escalate-confirmations: touch2=${result.touch2Sent} touch3=${result.touch3Sent} timedOut=${result.timedOut} backfilled=${result.backfilled} errors=${result.errors}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[Cron] escalate-confirmations error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
