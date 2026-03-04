/**
 * Cron endpoint — expire timed-out offers every 30 minutes.
 * Protected by CRON_SECRET env var (Vercel Cron Authorization header).
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkExpiredOffers } from "@/lib/backfill/check-expired-offers";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

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
