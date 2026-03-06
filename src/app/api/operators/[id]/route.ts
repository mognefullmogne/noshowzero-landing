// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { z } from "zod";

const UpdateOperatorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.string().max(100).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateOperatorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("operators")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .select("*")
      .single();

    if (error) {
      console.error("Operator update error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to update operator" } },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Operator not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Operators PATCH error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const supabase = await createClient();
    const { error } = await supabase
      .from("operators")
      .delete()
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId);

    if (error) {
      console.error("Operator delete error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to delete operator" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Operators DELETE error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
