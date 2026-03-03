import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";

const AVG_APPOINTMENT_VALUE = 150;

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    const supabase = await createServiceClient();
    const tenantId = auth.tenantId;

    const buildQuery = (status?: string) => {
      let q = supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      if (status) q = q.eq("status", status);
      return q;
    };

    const [totalRes, noShowRes, completedRes, confirmedRes, waitlistRes] = await Promise.all([
      buildQuery(),
      buildQuery("no_show"),
      buildQuery("completed"),
      buildQuery("confirmed"),
      supabase
        .from("waitlist_entries")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "fulfilled"),
    ]);

    const total = totalRes.count ?? 0;
    const noShowCount = noShowRes.count ?? 0;
    const completedCount = completedRes.count ?? 0;
    const confirmedCount = confirmedRes.count ?? 0;
    const waitlistFills = waitlistRes.count ?? 0;
    const noShowRate = total > 0 ? Math.round((noShowCount / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        total_appointments: total,
        no_show_rate: noShowRate,
        no_show_count: noShowCount,
        completed_count: completedCount,
        confirmed_count: confirmedCount,
        waitlist_fills: waitlistFills,
        revenue_saved: (confirmedCount + completedCount + waitlistFills) * AVG_APPOINTMENT_VALUE,
      },
    });
  } catch (err) {
    console.error("v1 analytics summary error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
