// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/kpi — Get KPI snapshots with period grouping.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { KpiFiltersSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = KpiFiltersSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const { from, to, period, page, pageSize } = parsed.data;
  const supabase = await createClient();

  let query = supabase
    .from("kpi_snapshots")
    .select("*", { count: "exact" })
    .eq("tenant_id", auth.data.tenantId)
    .eq("period", period)
    .order("snapshot_date", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (from) query = query.gte("snapshot_date", from);
  if (to) query = query.lte("snapshot_date", to);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: error.message } },
      { status: 500 }
    );
  }

  const total = count ?? 0;
  return NextResponse.json({
    success: true,
    data: data ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
