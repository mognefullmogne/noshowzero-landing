// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { z } from "zod";

const CreateServiceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  duration_min: z.number().int().min(1).max(480).default(30),
  price: z.number().min(0).nullable().optional(),
  currency: z.string().length(3).default("EUR"),
  is_active: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active") === "true";

    const supabase = await createClient();
    let query = supabase
      .from("services")
      .select("*")
      .eq("tenant_id", auth.data.tenantId)
      .order("name");

    if (activeOnly) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) {
      console.error("Services fetch error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to fetch services" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error("Services GET error:", err);
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
    const parsed = CreateServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("services")
      .insert({ ...parsed.data, tenant_id: auth.data.tenantId })
      .select("*")
      .single();

    if (error) {
      console.error("Service insert error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to create service" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("Services POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
