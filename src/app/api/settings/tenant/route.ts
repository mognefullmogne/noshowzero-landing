// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { TenantSettingsUpdateSchema } from "@/lib/validations";

/**
 * GET /api/settings/tenant
 * Returns the authenticated tenant's settings.
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const supabase = await createClient();

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("avg_appointment_value, name, industry, business_size")
      .eq("id", auth.data.tenantId)
      .single();

    if (error || !tenant) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Tenant not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        avg_appointment_value: tenant.avg_appointment_value,
        name: tenant.name,
        industry: tenant.industry,
        business_size: tenant.business_size,
      },
    });
  } catch (err) {
    console.error("Tenant settings GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/tenant
 * Updates the authenticated tenant's settings (currently avg_appointment_value).
 * Validates input with Zod: positive number, max 10000.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const body: unknown = await request.json();
    const parsed = TenantSettingsUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues.map((e: { message: string }) => e.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: updated, error } = await supabase
      .from("tenants")
      .update({ avg_appointment_value: parsed.data.avg_appointment_value })
      .eq("auth_user_id", auth.data.userId)
      .select("avg_appointment_value, name, industry, business_size")
      .single();

    if (error) {
      console.error("Tenant settings PATCH error:", error);
      return NextResponse.json(
        { success: false, error: { code: "UPDATE_FAILED", message: "Failed to update tenant settings" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        avg_appointment_value: updated.avg_appointment_value,
        name: updated.name,
        industry: updated.industry,
        business_size: updated.business_size,
      },
    });
  } catch (err) {
    console.error("Tenant settings PATCH error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
