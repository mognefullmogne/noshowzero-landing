/**
 * POST /api/rules/[id]/versions — Create a new rule version.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { CreateRuleVersionSchema } from "@/lib/validations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { id: rulesetId } = await params;
  const body = await request.json();
  const parsed = CreateRuleVersionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Verify ruleset belongs to tenant
  const { data: ruleset } = await supabase
    .from("rulesets")
    .select("id")
    .eq("id", rulesetId)
    .eq("tenant_id", auth.data.tenantId)
    .maybeSingle();

  if (!ruleset) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Ruleset not found" } },
      { status: 404 }
    );
  }

  // Get next version number
  const { data: latestVersion } = await supabase
    .from("rule_versions")
    .select("version")
    .eq("ruleset_id", rulesetId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  // Deactivate previous versions
  await supabase
    .from("rule_versions")
    .update({ is_active: false })
    .eq("ruleset_id", rulesetId)
    .eq("is_active", true);

  // Create new version
  const { data, error } = await supabase
    .from("rule_versions")
    .insert({
      ruleset_id: rulesetId,
      tenant_id: auth.data.tenantId,
      version: nextVersion,
      conditions: parsed.data.conditions,
      actions: parsed.data.actions,
      notes: parsed.data.notes,
      is_active: true,
    })
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
