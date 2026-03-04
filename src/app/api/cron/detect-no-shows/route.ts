/**
 * Cron: Detect no-shows (every 15 min).
 * Finds appointments that are 15+ minutes overdue and marks them as no_show.
 * Triggers cascade backfill for each detected no-show.
 */

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { detectNoShowsAllTenants } from "@/lib/intelligence/no-show-detector";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not set — refusing to run cron endpoint");
    return NextResponse.json({ error: "Service misconfigured" }, { status: 500 });
  }

  if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
