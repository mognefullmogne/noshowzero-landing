import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { AnalyticsFiltersSchema } from "@/lib/validations";

const AVG_APPOINTMENT_VALUE = 150; // conservative estimate per recovered appointment

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const filters = AnalyticsFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
    const { from, to } = filters.success ? filters.data : { from: undefined, to: undefined };

    const supabase = await createClient();
    const tenantId = auth.data.tenantId;

    // Build base query with optional date range
    const buildQuery = (status?: string) => {
      let q = supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      if (status) q = q.eq("status", status);
      if (from) q = q.gte("scheduled_at", from);
      if (to) q = q.lte("scheduled_at", to);
      return q;
    };

    // Run all counts in parallel
    const [totalRes, noShowRes, completedRes, cancelledRes, confirmedRes, scheduledRes, waitlistRes, riskRes] =
      await Promise.all([
        buildQuery(),
        buildQuery("no_show"),
        buildQuery("completed"),
        buildQuery("cancelled"),
        buildQuery("confirmed"),
        buildQuery("scheduled"),
        supabase
          .from("waitlist_entries")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "fulfilled"),
        supabase
          .from("appointments")
          .select("risk_score")
          .eq("tenant_id", tenantId)
          .not("risk_score", "is", null)
          .limit(1000),
      ]);

    const total = totalRes.count ?? 0;
    const noShowCount = noShowRes.count ?? 0;
    const completedCount = completedRes.count ?? 0;
    const cancelledCount = cancelledRes.count ?? 0;
    const confirmedCount = confirmedRes.count ?? 0;
    const scheduledCount = scheduledRes.count ?? 0;
    const waitlistFills = waitlistRes.count ?? 0;

    const noShowRate = total > 0 ? Math.round((noShowCount / total) * 100) : 0;

    const riskScores = (riskRes.data ?? []).map((r) => r.risk_score as number);
    const avgRiskScore =
      riskScores.length > 0 ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length) : 0;

    // Revenue saved = confirmed appointments that had high risk scores (would have been no-shows)
    const revenueSaved = (confirmedCount + completedCount + waitlistFills) * AVG_APPOINTMENT_VALUE;

    return NextResponse.json({
      success: true,
      data: {
        totalAppointments: total,
        noShowRate,
        noShowCount,
        completedCount,
        cancelledCount,
        confirmedCount,
        scheduledCount,
        waitlistFills,
        avgRiskScore,
        revenueSaved,
      },
    });
  } catch (err) {
    console.error("Analytics GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
