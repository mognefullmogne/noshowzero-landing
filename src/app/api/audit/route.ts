// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/audit — List audit events with filters, paginated.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { AuditFiltersSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = AuditFiltersSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const { entity_type, entity_id, action, actor_type, from, to, page, pageSize } = parsed.data;
  const supabase = await createClient();

  let query = supabase
    .from("audit_events")
    .select("*", { count: "exact" })
    .eq("tenant_id", auth.data.tenantId)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (entity_type) query = query.eq("entity_type", entity_type);
  if (entity_id) query = query.eq("entity_id", entity_id);
  if (action) query = query.eq("action", action);
  if (actor_type) query = query.eq("actor_type", actor_type);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

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
