// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function searchAppointments(
  supabase: SupabaseClient,
  tenantId: string,
  input: Record<string, unknown>
) {
  let query = supabase
    .from("appointments")
    .select("id, service_name, provider_name, scheduled_at, status, patient:patients(first_name, last_name)")
    .eq("tenant_id", tenantId)
    .order("scheduled_at", { ascending: false })
    .limit(20);

  if (input.status) {
    query = query.eq("status", input.status as string);
  }
  if (input.from_date) {
    query = query.gte("scheduled_at", input.from_date as string);
  }
  if (input.to_date) {
    query = query.lte("scheduled_at", input.to_date as string);
  }

  const { data, error } = await query;

  if (error) return { error: error.message };

  // Filter by patient name if query provided
  let results = data ?? [];
  if (input.query) {
    const q = (input.query as string).toLowerCase();
    results = results.filter((a) => {
      const patient = a.patient as unknown as Record<string, string> | null;
      if (!patient) return false;
      const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
      return fullName.includes(q);
    });
  }

  return {
    count: results.length,
    appointments: results.map((a) => {
      const patient = a.patient as unknown as Record<string, string> | null;
      return {
        id: a.id,
        patient_name: patient ? `${patient.first_name} ${patient.last_name}` : "N/A",
        service: a.service_name,
        provider: a.provider_name,
        date: a.scheduled_at,
        status: a.status,
      };
    }),
  };
}
