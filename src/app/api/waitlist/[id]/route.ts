// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { UpdateWaitlistEntrySchema } from "@/lib/validations";
import type { WaitlistStatus } from "@/lib/types";

// Only allow manual updates to these statuses (system-managed states are excluded)
const USER_SETTABLE_STATUSES: readonly WaitlistStatus[] = ["waiting", "withdrawn"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateWaitlistEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    // Validate status transition if status is being changed
    if (parsed.data.status && !USER_SETTABLE_STATUSES.includes(parsed.data.status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: `Cannot manually set status to '${parsed.data.status}'. Allowed: ${USER_SETTABLE_STATUSES.join(", ")}`,
          },
        },
        { status: 422 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("waitlist_entries")
      .update(parsed.data)
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .select("*, patient:patients(*)")
      .single();

    if (error) {
      console.error("Waitlist PATCH error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to update waitlist entry" } },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Waitlist entry not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Waitlist PATCH error:", err);
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

    // Verify the entry exists first
    const { data: existing } = await supabase
      .from("waitlist_entries")
      .select("id, status")
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Waitlist entry not found" } },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ status: "withdrawn" })
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId);

    if (error) {
      console.error("Waitlist DELETE error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to withdraw entry" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { message: "Entry withdrawn" } });
  } catch (err) {
    console.error("Waitlist DELETE error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
