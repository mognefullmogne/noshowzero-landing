/**
 * GET  /api/slots — List slots with filters.
 * POST /api/slots — Create a slot or block a time.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { SlotFiltersSchema, CreateSlotSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = SlotFiltersSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const { provider_name, status, from, to, page, pageSize } = parsed.data;
  const supabase = await createClient();

  let query = supabase
    .from("appointment_slots")
    .select("*", { count: "exact" })
    .eq("tenant_id", auth.data.tenantId)
    .order("start_at", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (provider_name) query = query.eq("provider_name", provider_name);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("start_at", from);
  if (to) query = query.lte("start_at", to);

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

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const parsed = CreateSlotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointment_slots")
    .insert({ tenant_id: auth.data.tenantId, ...parsed.data })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
