// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { generateMorningBriefing } from "@/lib/ai/morning-briefing";

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const forceRefresh = searchParams.get("refresh") === "1";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid date format. Use YYYY-MM-DD." } },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const before = Date.now();
    const result = await generateMorningBriefing(supabase, auth.tenantId, date, forceRefresh);
    const elapsed = Date.now() - before;

    const cached = !forceRefresh && elapsed < 200;

    return NextResponse.json({
      success: true,
      data: {
        briefing: result.briefing,
        date,
        generated_at: result.generatedAt,
        cached,
      },
    });
  } catch (err) {
    console.error("v1 briefing GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
