// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET    /api/integrations/[id] — Single integration details
 * PATCH  /api/integrations/[id] — Update (pause/resume, change calendar selection)
 * DELETE /api/integrations/[id] — Revoke and delete integration
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createClient();

  // Select only safe columns — never expose tokens to the client
  const SAFE_COLS = "id, tenant_id, provider, label, token_expires_at, calendar_ids, last_sync_at, status, error_message, created_at, updated_at";

  const [{ data: integration }, { data: logs }] = await Promise.all([
    supabase
      .from("calendar_integrations")
      .select(SAFE_COLS)
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .maybeSingle(),
    supabase
      .from("import_logs")
      .select("*")
      .eq("integration_id", id)
      .eq("tenant_id", auth.data.tenantId)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  if (!integration) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Integration not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { ...integration, importLogs: logs ?? [] },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createClient();

  let body: {
    status?: "active" | "paused";
    calendar_ids?: string[];
    label?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_BODY", message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (body.status && ["active", "paused"].includes(body.status)) {
    updateData.status = body.status;
  }
  if (body.calendar_ids) {
    updateData.calendar_ids = body.calendar_ids;
  }
  if (body.label) {
    updateData.label = body.label;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { success: false, error: { code: "NO_CHANGES", message: "No valid fields to update" } },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("calendar_integrations")
    .update(updateData)
    .eq("id", id)
    .eq("tenant_id", auth.data.tenantId)
    .select("id, tenant_id, provider, label, token_expires_at, calendar_ids, last_sync_at, status, error_message, created_at, updated_at")
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("calendar_integrations")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.data.tenantId);

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "DELETE_FAILED", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: { deleted: true } });
}
