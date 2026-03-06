// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { z } from "zod";

const PutServicesSchema = z.object({
  service_ids: z.array(z.string().uuid()),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id: operatorId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("operator_services")
      .select("service_id")
      .eq("operator_id", operatorId)
      .eq("tenant_id", auth.data.tenantId);

    if (error) {
      console.error("Operator services fetch error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to fetch operator services" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((r) => r.service_id),
    });
  } catch (err) {
    console.error("Operator services GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id: operatorId } = await params;
    const body = await request.json();
    const parsed = PutServicesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Delete existing assignments for this operator
    const { error: deleteError } = await supabase
      .from("operator_services")
      .delete()
      .eq("operator_id", operatorId)
      .eq("tenant_id", auth.data.tenantId);

    if (deleteError) {
      console.error("Operator services delete error:", deleteError);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to update operator services" } },
        { status: 500 }
      );
    }

    // Insert new assignments
    if (parsed.data.service_ids.length > 0) {
      const rows = parsed.data.service_ids.map((serviceId) => ({
        operator_id: operatorId,
        service_id: serviceId,
        tenant_id: auth.data.tenantId,
      }));

      const { error: insertError } = await supabase
        .from("operator_services")
        .insert(rows);

      if (insertError) {
        console.error("Operator services insert error:", insertError);
        return NextResponse.json(
          { success: false, error: { code: "DB_ERROR", message: "Failed to update operator services" } },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, data: parsed.data.service_ids });
  } catch (err) {
    console.error("Operator services PUT error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
