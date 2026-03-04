/**
 * Cron: Detect no-shows (every 15 min).
 * Finds appointments that are 15+ minutes overdue and marks them as no_show.
 * Triggers cascade backfill for each detected no-show.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { detectNoShowsAllTenants } from "@/lib/intelligence/no-show-detector";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = await createServiceClient();
    const result = await detectNoShowsAllTenants(supabase);

    console.info(
      `[Cron] detect-no-shows: detected=${result.detected}, cascaded=${result.cascaded}, errors=${result.errors}`
    );

    return NextResponse.json({
      success: true,
      detected: result.detected,
      cascaded: result.cascaded,
      errors: result.errors,
    });
  } catch (err) {
    console.error("[Cron] detect-no-shows error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
