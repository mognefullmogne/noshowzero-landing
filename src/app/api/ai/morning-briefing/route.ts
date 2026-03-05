// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/ai/morning-briefing
 *
 * Returns the AI-generated daily briefing for clinic staff.
 * Protected by session auth.
 * Optional query param: ?refresh=1 to force regeneration.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { generateMorningBriefing } from "@/lib/ai/morning-briefing";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const forceRefresh = searchParams.get("refresh") === "1";

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid date format. Use YYYY-MM-DD." } },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const result = await generateMorningBriefing(
      supabase,
      auth.data.tenantId,
      date,
      forceRefresh
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[API] Morning briefing error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
