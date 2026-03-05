// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/ai/no-show-analysis
 * Returns AI-generated no-show root cause analysis for the authenticated tenant.
 * Results are cached for 24 hours (in-memory via analyzeNoShowPatterns).
 *
 * Query params:
 *   refresh=true  — force cache invalidation before fetching
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { analyzeNoShowPatterns, invalidateAnalysisCache } from "@/lib/ai/no-show-analysis";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { tenantId } = auth.data;
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  if (forceRefresh) {
    invalidateAnalysisCache(tenantId);
  }

  try {
    const supabase = await createServiceClient();
    const result = await analyzeNoShowPatterns(supabase, tenantId);

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      data: result.data,
      generatedAt: result.generatedAt,
    });
  } catch (err) {
    console.error("[NoShowAnalysis] API error:", err);
    return NextResponse.json(
      { success: false, error: { code: "ANALYSIS_ERROR", message: "Analisi non disponibile al momento." } },
      { status: 500 }
    );
  }
}
