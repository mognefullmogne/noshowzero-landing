// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * PATCH /api/optimization/decisions/[id] — Approve or reject a decision.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { ApproveDecisionSchema } from "@/lib/validations";
import { executeDecision } from "@/lib/optimization/calendar-optimizer";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json();
  const parsed = ApproveDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  if (parsed.data.status === "rejected") {
    const { data, error } = await supabase
      .from("optimization_decisions")
      .update({ status: "rejected" })
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .eq("status", "proposed")
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: { code: "UPDATE_FAILED", message: "Decision not found or already processed" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  }

  // Approve and execute
  const { error: approveError } = await supabase
    .from("optimization_decisions")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", auth.data.tenantId)
    .eq("status", "proposed");

  if (approveError) {
    return NextResponse.json(
      { success: false, error: { code: "APPROVE_FAILED", message: approveError.message } },
      { status: 500 }
    );
  }

  // Execute the decision
  const execResult = await executeDecision(supabase, auth.data.tenantId, id);
  if (!execResult.success) {
    return NextResponse.json(
      { success: false, error: { code: "EXEC_FAILED", message: execResult.error ?? "Execution failed" } },
      { status: 500 }
    );
  }

  const { data: updated } = await supabase
    .from("optimization_decisions")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ success: true, data: updated });
}
