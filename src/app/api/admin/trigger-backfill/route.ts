// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Admin endpoint: trigger backfill for a specific cancelled appointment.
 * Auth: CRON_SECRET via Authorization header.
 *
 * POST /api/admin/trigger-backfill
 * Body: { "appointmentId": "uuid", "tenantId": "uuid" }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function POST(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body?.appointmentId || !body?.tenantId) {
    return NextResponse.json(
      { error: "Missing appointmentId or tenantId" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();
  const offerId = await triggerBackfill(supabase, body.appointmentId, body.tenantId, {
    triggerEvent: "cancellation",
  });

  return NextResponse.json({
    success: true,
    offerId: offerId ?? null,
    message: offerId ? `Offer ${offerId} created and sent` : "No offer sent (AI deferred or no candidates)",
  });
}
