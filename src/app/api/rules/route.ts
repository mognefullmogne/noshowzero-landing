// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET  /api/rules — List rulesets.
 * POST /api/rules — Create a new ruleset.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { CreateRulesetSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entity_type");

  const supabase = await createClient();
  let query = supabase
    .from("rulesets")
    .select("*")
    .eq("tenant_id", auth.data.tenantId)
    .order("created_at", { ascending: false });

  if (entityType) query = query.eq("entity_type", entityType);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const parsed = CreateRulesetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rulesets")
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
