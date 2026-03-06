// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { z } from "zod";

const CreateOperatorSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  is_active: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active") === "true";
    const serviceId = url.searchParams.get("service_id");

    const supabase = await createClient();

    if (serviceId) {
      // Return only operators that can perform the given service
      const { data: opSvcRows, error: osError } = await supabase
        .from("operator_services")
        .select("operator_id")
        .eq("service_id", serviceId)
        .eq("tenant_id", auth.data.tenantId);

      if (osError) {
        console.error("Operator services fetch error:", osError);
        return NextResponse.json(
          { success: false, error: { code: "DB_ERROR", message: "Failed to fetch operators" } },
          { status: 500 }
        );
      }

      const operatorIds = (opSvcRows ?? []).map((r) => r.operator_id);
      if (operatorIds.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }

      let query = supabase
        .from("operators")
        .select("*")
        .eq("tenant_id", auth.data.tenantId)
        .in("id", operatorIds)
        .order("name");

      if (activeOnly) query = query.eq("is_active", true);

      const { data, error } = await query;
      if (error) {
        console.error("Operators fetch error:", error);
        return NextResponse.json(
          { success: false, error: { code: "DB_ERROR", message: "Failed to fetch operators" } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data: data ?? [] });
    }

    // No service_id filter — return all operators
    let query = supabase
      .from("operators")
      .select("*")
      .eq("tenant_id", auth.data.tenantId)
      .order("name");

    if (activeOnly) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) {
      console.error("Operators fetch error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to fetch operators" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error("Operators GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = CreateOperatorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("operators")
      .insert({ ...parsed.data, tenant_id: auth.data.tenantId })
      .select("*")
      .single();

    if (error) {
      console.error("Operator insert error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to create operator" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("Operators POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
