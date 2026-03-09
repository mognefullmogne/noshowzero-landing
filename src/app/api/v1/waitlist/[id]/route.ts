// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const supabase = await createServiceClient();

    const { data: entry, error } = await supabase
      .from("waitlist_entries")
      .select(
        "id, status, service_name, clinical_urgency, preferred_provider, preferred_time_slots, flexible_time, smart_score, smart_score_breakdown, priority_score, priority_reason, valid_until, max_offers, notes, created_at, updated_at, patient:patients(id, external_id, first_name, last_name, phone, email)"
      )
      .eq("id", id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();

    if (error || !entry) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Waitlist entry not found" } },
        { status: 404 }
      );
    }

    // Fetch offers history for this waitlist entry
    const { data: offers } = await supabase
      .from("offers")
      .select("id, status, slot_start, slot_end, offered_at, responded_at, expires_at")
      .eq("waitlist_entry_id", id)
      .order("offered_at", { ascending: false });

    return NextResponse.json({
      success: true,
      data: { ...entry, offers: offers ?? [] },
    });
  } catch (err) {
    console.error("v1 waitlist GET [id] error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const supabase = await createServiceClient();

    // Verify entry exists and belongs to tenant
    const { data: existing } = await supabase
      .from("waitlist_entries")
      .select("id, status")
      .eq("id", id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Waitlist entry not found" } },
        { status: 404 }
      );
    }

    if (existing.status === "withdrawn") {
      return NextResponse.json({
        success: true,
        data: { message: "Entry already withdrawn" },
      });
    }

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ status: "withdrawn" })
      .eq("id", id)
      .eq("tenant_id", auth.tenantId);

    if (error) {
      console.error("v1 waitlist DELETE error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to withdraw entry" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: "Entry withdrawn" },
    });
  } catch (err) {
    console.error("v1 waitlist DELETE error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
