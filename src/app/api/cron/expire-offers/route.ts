/**
 * Cron endpoint — expire timed-out offers every 30 minutes.
 * Protected by CRON_SECRET env var (Vercel Cron Authorization header).
 */

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkExpiredOffers } from "@/lib/backfill/check-expired-offers";

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
    const result = await checkExpiredOffers(supabase);

    console.info(`[Cron] expire-offers: expired=${result.expired}, cascaded=${result.cascaded}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Cron expire-offers error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
