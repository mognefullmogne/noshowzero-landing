// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Cron: Cleanup expired slot proposals (every 1 hour).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  // Expire pending proposals past their deadline
  const { data: expired, error } = await supabase
    .from("slot_proposals")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lte("expires_at", now)
    .select("id");

  // Also expire proposed optimization decisions
  const { data: expiredDecisions } = await supabase
    .from("optimization_decisions")
    .update({ status: "expired" })
    .eq("status", "proposed")
    .lte("expires_at", now)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    expired_proposals: (expired ?? []).length,
    expired_decisions: (expiredDecisions ?? []).length,
  });
}
