// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * PATCH /api/patients/[id] — Update patient info.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { UpdatePatientSchema } from "@/lib/validations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "Invalid patient ID" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = UpdatePatientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("patients")
      .update(parsed.data)
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: { code: "UPDATE_FAILED", message: error?.message ?? "Patient not found" } },
        { status: error ? 500 : 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Patient PATCH error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
