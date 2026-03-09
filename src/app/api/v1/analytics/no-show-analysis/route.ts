// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { analyzeNoShowPatterns, invalidateAnalysisCache } from "@/lib/ai/no-show-analysis";

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
    const forceRefresh = searchParams.get("refresh") === "1";

    if (forceRefresh) {
      invalidateAnalysisCache(auth.tenantId);
    }

    const supabase = await createServiceClient();
    const before = Date.now();
    const result = await analyzeNoShowPatterns(supabase, auth.tenantId);
    const elapsed = Date.now() - before;

    // If the call returned almost instantly, the result was cached
    const cached = !forceRefresh && elapsed < 200;

    return NextResponse.json({
      success: true,
      data: {
        analysis: result.analysis,
        generated_at: result.generatedAt,
        cached,
      },
    });
  } catch (err) {
    console.error("v1 no-show-analysis GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
