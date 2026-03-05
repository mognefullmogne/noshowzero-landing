// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { SIDEBAR_HREFS } from "@/lib/sidebar-links";

/**
 * PATCH /api/settings/sidebar-order
 * Saves the user's custom sidebar link order.
 * Accepts { order: string[] } where each entry is a valid sidebar href.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      !("order" in body) ||
      !Array.isArray((body as { order: unknown }).order)
    ) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Body must contain { order: string[] }" } },
        { status: 400 },
      );
    }

    const order = (body as { order: string[] }).order;

    // Every href in the payload must be a known sidebar link
    const invalid = order.filter((href) => !SIDEBAR_HREFS.has(href));
    if (invalid.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: `Unknown hrefs: ${invalid.join(", ")}` } },
        { status: 400 },
      );
    }

    // Must contain exactly the same hrefs (no duplicates, no missing)
    if (order.length !== SIDEBAR_HREFS.size || new Set(order).size !== order.length) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Order must contain all sidebar links exactly once" } },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("tenants")
      .update({ sidebar_order: order })
      .eq("auth_user_id", auth.data.userId);

    if (error) {
      console.error("Sidebar order PATCH error:", error);
      return NextResponse.json(
        { success: false, error: { code: "UPDATE_FAILED", message: "Failed to save sidebar order" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: { sidebar_order: order } });
  } catch (err) {
    console.error("Sidebar order PATCH error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}
