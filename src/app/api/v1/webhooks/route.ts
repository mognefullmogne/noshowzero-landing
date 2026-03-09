// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { PublicCreateWebhookSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 },
      );
    }

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("webhook_endpoints")
      .select("id, url, events, is_active, created_at, updated_at")
      .eq("tenant_id", auth.tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("v1 webhooks GET error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to fetch webhooks" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error("v1 webhooks GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = PublicCreateWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      );
    }

    const secret = randomBytes(32).toString("hex");
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("webhook_endpoints")
      .insert({
        tenant_id: auth.tenantId,
        url: parsed.data.url,
        secret,
        events: parsed.data.events,
        is_active: true,
      })
      .select("id, url, secret, events, is_active, created_at")
      .single();

    if (error) {
      console.error("v1 webhooks POST error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to create webhook" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("v1 webhooks POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}
