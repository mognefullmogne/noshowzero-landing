// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/ai/strategy-log
 *
 * Returns recent AI strategy decisions from the audit log.
 * Shows what the decision engine decided for each cancellation/no-show/timeout
 * and why. Enables staff to see the AI's reasoning in the dashboard.
 *
 * Query params:
 *   - limit: number (default 20, max 50)
 *   - offset: number (default 0) for pagination
 *   - action: filter by specific action type
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";

const STRATEGY_ACTIONS = [
  "ai_strategy_applied",
  "cascade_deferred",
  "cascade_manual_review",
  "cascade_exhausted",
] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
    const actionFilter = searchParams.get("action");

    const supabase = await createServiceClient();

    let query = supabase
      .from("audit_events")
      .select("id, entity_id, action, metadata, created_at")
      .eq("tenant_id", auth.data.tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (actionFilter && STRATEGY_ACTIONS.includes(actionFilter as typeof STRATEGY_ACTIONS[number])) {
      query = query.eq("action", actionFilter);
    } else {
      query = query.in("action", [...STRATEGY_ACTIONS]);
    }

    const { data: entries, error, count } = await query;

    if (error) {
      console.error("[StrategyLog] Query error:", error);
      return NextResponse.json({ success: false, error: "Failed to fetch strategy log" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      entries: entries ?? [],
      count: entries?.length ?? 0,
      hasMore: (entries?.length ?? 0) >= limit,
    });
  } catch (err) {
    console.error("[StrategyLog] Unexpected error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
