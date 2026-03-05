// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getPatientInfo(
  supabase: SupabaseClient,
  tenantId: string,
  input: Record<string, unknown>
) {
  let patient: Record<string, unknown> | null = null;

  if (input.patient_id) {
    const { data } = await supabase
      .from("patients")
      .select("*")
      .eq("id", input.patient_id as string)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    patient = data;
  } else if (input.patient_name) {
    const name = (input.patient_name as string).toLowerCase();
    const { data: patients } = await supabase
      .from("patients")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .limit(50);

    patient =
      (patients ?? []).find((p) => {
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        return fullName.includes(name);
      }) ?? null;
  }

  if (!patient) return { error: "Paziente non trovato" };

  // Get appointment history
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, service_name, scheduled_at, status")
    .eq("patient_id", patient.id as string)
    .eq("tenant_id", tenantId)
    .order("scheduled_at", { ascending: false })
    .limit(10);

  const { count: totalAppts } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patient.id as string)
    .eq("tenant_id", tenantId);

  const { count: noShows } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patient.id as string)
    .eq("tenant_id", tenantId)
    .eq("status", "no_show");

  return {
    patient: {
      id: patient.id,
      name: `${patient.first_name} ${patient.last_name}`,
      phone: patient.phone,
      email: patient.email,
      preferred_channel: patient.preferred_channel,
    },
    stats: {
      total_appointments: totalAppts ?? 0,
      no_shows: noShows ?? 0,
      no_show_rate: totalAppts ? ((noShows ?? 0) / totalAppts * 100).toFixed(1) + "%" : "N/A",
    },
    recent_appointments: appointments ?? [],
  };
}
