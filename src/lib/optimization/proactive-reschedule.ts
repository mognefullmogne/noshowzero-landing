// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Proactive reschedule — flag appointments with risk >= 70 for reschedule consideration.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const RISK_THRESHOLD = 70;

export async function flagHighRiskAppointments(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ flagged: number }> {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Find high-risk appointments in the next 7 days
  const { data: highRisk } = await supabase
    .from("appointments")
    .select("id, patient_id, service_name, provider_name, scheduled_at, risk_score, patient:patients(first_name, last_name)")
    .eq("tenant_id", tenantId)
    .in("status", ["scheduled", "reminder_pending", "reminder_sent"])
    .gte("risk_score", RISK_THRESHOLD)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", weekEnd.toISOString())
    .order("risk_score", { ascending: false })
    .limit(20);

  if (!highRisk || highRisk.length === 0) return { flagged: 0 };

  let flagged = 0;

  for (const appt of highRisk) {
    // Check if we already have a decision for this appointment
    const { data: existing } = await supabase
      .from("optimization_decisions")
      .select("id")
      .eq("source_appointment_id", appt.id)
      .eq("type", "proactive_reschedule")
      .in("status", ["proposed", "approved"])
      .maybeSingle();

    if (existing) continue;

    const patient = appt.patient as unknown as Record<string, string> | null;
    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "N/A";

    const { error } = await supabase.from("optimization_decisions").insert({
      tenant_id: tenantId,
      type: "proactive_reschedule",
      status: "proposed",
      description: `Appuntamento ad alto rischio (${appt.risk_score}%) per ${patientName} — considerare riprogrammazione`,
      reasoning: `Risk score: ${appt.risk_score}/100. Servizio: ${appt.service_name}. Data: ${new Date(appt.scheduled_at).toLocaleDateString("it-IT")}`,
      score: appt.risk_score ?? 0,
      source_appointment_id: appt.id,
      proposed_changes: {
        action: "proactive_reschedule",
        appointment_id: appt.id,
        current_date: appt.scheduled_at,
        risk_score: appt.risk_score,
      },
      expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    });

    if (!error) flagged++;
  }

  return { flagged };
}
