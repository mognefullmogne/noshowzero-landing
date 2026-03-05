// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { PublicUpsertPatientSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = PublicUpsertPatientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Check if patient exists by external_id
    const { data: existing } = await supabase
      .from("patients")
      .select("id")
      .eq("tenant_id", auth.tenantId)
      .eq("external_id", parsed.data.external_id)
      .maybeSingle();

    if (existing) {
      // Update existing patient
      const { data: updated, error } = await supabase
        .from("patients")
        .update({
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name,
          phone: parsed.data.phone,
          email: parsed.data.email,
          preferred_channel: parsed.data.preferred_channel,
        })
        .eq("id", existing.id)
        .select("id, external_id, first_name, last_name, email, preferred_channel, is_active")
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: "DB_ERROR", message: "Failed to update patient" } },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data: { ...updated, created: false } });
    }

    // Create new patient
    const { data: created, error } = await supabase
      .from("patients")
      .insert({ tenant_id: auth.tenantId, ...parsed.data })
      .select("id, external_id, first_name, last_name, email, preferred_channel, is_active")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to create patient" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { ...created, created: true } }, { status: 201 });
  } catch (err) {
    console.error("v1 patients POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
