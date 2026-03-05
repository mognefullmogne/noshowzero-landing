// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { computeRecoveryMetrics } from "@/lib/metrics/recovery-metrics";

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

    const [totalRes, noShowRes, completedRes, confirmedRes, recoveryRes, tenantDataRes] = await Promise.all([
      buildQuery(),
      buildQuery("no_show"),
      buildQuery("completed"),
      buildQuery("confirmed"),
      supabase
        .from("waitlist_offers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "accepted")
        .not("new_appointment_id", "is", null),
      supabase
        .from("tenants")
        .select("avg_appointment_value")
        .eq("id", tenantId)
        .single(),
    ]);

    const total = totalRes.count ?? 0;
    const noShowCount = noShowRes.count ?? 0;
    const completedCount = completedRes.count ?? 0;
    const confirmedCount = confirmedRes.count ?? 0;
    const cancelledCount = 0; // v1 summary does not track cancelled separately
    const slotsRecoveredCount = recoveryRes.count ?? 0;
    const avgAppointmentValue = tenantDataRes.data?.avg_appointment_value ?? 80;
    const noShowRate = total > 0 ? Math.round((noShowCount / total) * 100) : 0;

    const recovery = computeRecoveryMetrics({
      cancelledCount,
      noShowCount,
      acceptedOffersWithNewAppt: slotsRecoveredCount,
      pendingOffersCount: 0,
      avgAppointmentValue,
    });

    return NextResponse.json({
      success: true,
      data: {
        total_appointments: total,
        no_show_rate: noShowRate,
        no_show_count: noShowCount,
        completed_count: completedCount,
        confirmed_count: confirmedCount,
        waitlist_fills: recovery.slotsRecovered,
        revenue_saved: recovery.revenueRecovered,
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
