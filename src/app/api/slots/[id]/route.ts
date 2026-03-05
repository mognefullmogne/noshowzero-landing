// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * PATCH /api/slots/[id] — Update slot status (block/unblock).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { UpdateSlotSchema } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json();
  const parsed = UpdateSlotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointment_slots")
    .update(parsed.data)
    .eq("id", id)
    .eq("tenant_id", auth.data.tenantId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: error.message } },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Slot not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data });
}
