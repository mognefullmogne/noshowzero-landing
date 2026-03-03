/**
 * GET /api/dashboard — Operational dashboard data.
 * Returns today's KPIs, pending confirmations, urgent deadlines, and recent activity.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const supabase = await createClient();
    const tenantId = auth.data.tenantId;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();

    const TERMINAL_STATUSES = ["declined", "cancelled", "timeout"];

    // Run all queries in parallel
    const [
      todayRes,
      weekRes,
      pendingRes,
      urgentRes,
      recentRes,
    ] = await Promise.all([
      // Today's active appointments
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("scheduled_at", todayStart)
        .lte("scheduled_at", todayEnd)
        .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`),

      // Next 7 days active appointments
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("scheduled_at", todayStart)
        .lte("scheduled_at", weekEnd)
        .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`),

      // Pending confirmations (awaiting patient reply)
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["scheduled", "reminder_pending", "reminder_sent"])
        .gte("scheduled_at", todayStart),

      // Urgent deadlines: appointments with confirmation_deadline within 2 hours
      supabase
        .from("appointments")
        .select("id, scheduled_at, service_name, confirmation_deadline, status, patient:patients(id, first_name, last_name)")
        .eq("tenant_id", tenantId)
        .in("status", ["reminder_sent", "reminder_pending"])
        .not("confirmation_deadline", "is", null)
        .gte("confirmation_deadline", now.toISOString())
        .lte("confirmation_deadline", twoHoursFromNow)
        .order("confirmation_deadline", { ascending: true })
        .limit(10),

      // Recent activity: last 15 appointments ordered by updated_at
      supabase
        .from("appointments")
        .select("id, status, scheduled_at, updated_at, risk_score, service_name, patient:patients(id, first_name, last_name)")
        .eq("tenant_id", tenantId)
        .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
        .order("updated_at", { ascending: false })
        .limit(15),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        todayCount: todayRes.count ?? 0,
        weekCount: weekRes.count ?? 0,
        pendingCount: pendingRes.count ?? 0,
        urgentCount: (urgentRes.data ?? []).length,
        urgentAppointments: urgentRes.data ?? [],
        recentActivity: recentRes.data ?? [],
      },
    });
  } catch (err) {
    console.error("Dashboard GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
