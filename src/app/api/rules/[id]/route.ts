/**
 * GET    /api/rules/[id] — Get ruleset with versions.
 * PATCH  /api/rules/[id] — Update ruleset.
 * DELETE /api/rules/[id] — Delete ruleset and its versions.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { UpdateRulesetSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createClient();

  const { data: ruleset } = await supabase
    .from("rulesets")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", auth.data.tenantId)
    .maybeSingle();

  if (!ruleset) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Ruleset not found" } },
      { status: 404 }
    );
  }

  const { data: versions } = await supabase
    .from("rule_versions")
    .select("*")
    .eq("ruleset_id", id)
    .order("version", { ascending: false });

  return NextResponse.json({
    success: true,
    data: { ...ruleset, versions: versions ?? [] },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json();
  const parsed = UpdateRulesetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rulesets")
    .update(parsed.data)
    .eq("id", id)
    .eq("tenant_id", auth.data.tenantId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_FAILED", message: error?.message ?? "Not found" } },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createClient();

  // Delete versions first, then ruleset
  const { error: versionsError } = await supabase
    .from("rule_versions")
    .delete()
    .eq("ruleset_id", id)
    .eq("tenant_id", auth.data.tenantId);

  if (versionsError) {
    return NextResponse.json(
      { success: false, error: { code: "DELETE_FAILED", message: "Failed to delete rule versions" } },
      { status: 500 }
    );
  }

  const { error } = await supabase
    .from("rulesets")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.data.tenantId);

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "DELETE_FAILED", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
