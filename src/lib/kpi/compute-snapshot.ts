// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Compute daily KPI snapshot for a tenant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KpiMetrics } from "@/lib/types";

const DEFAULT_APPOINTMENT_VALUE = 80; // EUR fallback

export async function computeDailySnapshot(
  supabase: SupabaseClient,
  tenantId: string,
  date: string, // YYYY-MM-DD
  avgAppointmentValue?: number
): Promise<KpiMetrics> {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  // Appointment counts
  const [total, noShows, cancellations, completions, confirmed] = await Promise.all([
    countAppointments(supabase, tenantId, dayStart, dayEnd),
    countAppointments(supabase, tenantId, dayStart, dayEnd, "no_show"),
    countAppointments(supabase, tenantId, dayStart, dayEnd, "cancelled"),
    countAppointments(supabase, tenantId, dayStart, dayEnd, "completed"),
    countAppointments(supabase, tenantId, dayStart, dayEnd, "confirmed"),
  ]);

  // Offer metrics -- select status, responded_at, offered_at, and new_appointment_id
  // so we can compute honest recovery (only accepted with new_appointment_id)
  const { data: offers } = await supabase
    .from("waitlist_offers")
    .select("status, responded_at, offered_at, new_appointment_id")
    .eq("tenant_id", tenantId)
    .gte("offered_at", dayStart)
    .lte("offered_at", dayEnd);

  const offerList = offers ?? [];
  const offersSent = offerList.length;
  const offersAccepted = offerList.filter(
    (o) => o.status === "accepted" && o.new_appointment_id !== null
  ).length;

  // Average response time
  let avgResponseMinutes: number | null = null;
  const responded = offerList.filter((o) => o.responded_at && o.offered_at);
  if (responded.length > 0) {
    const totalMinutes = responded.reduce((sum, o) => {
      const diff = new Date(o.responded_at).getTime() - new Date(o.offered_at).getTime();
      return sum + diff / 60000;
    }, 0);
    avgResponseMinutes = Math.round(totalMinutes / responded.length);
  }

  // Risk score average
  const { data: riskData } = await supabase
    .from("appointments")
    .select("risk_score")
    .eq("tenant_id", tenantId)
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd)
    .not("risk_score", "is", null);

  const avgRiskScore =
    riskData && riskData.length > 0
      ? Math.round(riskData.reduce((sum, a) => sum + (a.risk_score ?? 0), 0) / riskData.length)
      : 0;

  // Optimization actions
  const { count: optimizationActions } = await supabase
    .from("optimization_decisions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "executed")
    .gte("executed_at", dayStart)
    .lte("executed_at", dayEnd);

  const confirmationRate = total > 0 ? Math.round(((confirmed + completions) / total) * 100) : 0;
  const backfillRate = offersSent > 0 ? Math.round((offersAccepted / offersSent) * 100) : 0;

  // Honest revenue: only accepted offers with new_appointment_id
  const appointmentValue = avgAppointmentValue ?? DEFAULT_APPOINTMENT_VALUE;
  const revenueSaved = offersAccepted * appointmentValue;

  return {
    total_appointments: total,
    no_shows: noShows,
    cancellations,
    completions,
    confirmation_rate: confirmationRate,
    avg_risk_score: avgRiskScore,
    offers_sent: offersSent,
    offers_accepted: offersAccepted,
    backfill_rate: backfillRate,
    avg_response_minutes: avgResponseMinutes,
    revenue_saved: revenueSaved,
    optimization_actions: optimizationActions ?? 0,
  };
}

async function countAppointments(
  supabase: SupabaseClient,
  tenantId: string,
  dayStart: string,
  dayEnd: string,
  status?: string
): Promise<number> {
  let query = supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd);

  if (status) query = query.eq("status", status);

  const { count } = await query;
  return count ?? 0;
}
