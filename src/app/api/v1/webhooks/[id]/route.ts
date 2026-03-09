// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { PublicUpdateWebhookSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = PublicUpdateWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      );
    }

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("webhook_endpoints")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", auth.tenantId)
      .select("id, url, events, is_active, created_at, updated_at")
      .single();

    if (error) {
      console.error("v1 webhooks PATCH error:", error);
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Webhook endpoint not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("v1 webhooks PATCH error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 },
      );
    }

    const { id } = await params;
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("webhook_endpoints")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", auth.tenantId)
      .select("id, url, is_active, updated_at")
      .single();

    if (error) {
      console.error("v1 webhooks DELETE error:", error);
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Webhook endpoint not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: { message: "Webhook deactivated", id: data.id } });
  } catch (err) {
    console.error("v1 webhooks DELETE error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}
