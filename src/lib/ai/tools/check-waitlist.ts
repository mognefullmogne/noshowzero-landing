// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function checkWaitlist(
  supabase: SupabaseClient,
  tenantId: string,
  input: Record<string, unknown>
) {
  let query = supabase
    .from("waitlist_entries")
    .select("id, service_name, preferred_provider, status, clinical_urgency, smart_score, created_at, patient:patients(first_name, last_name)")
    .eq("tenant_id", tenantId)
    .order("smart_score", { ascending: false, nullsFirst: false })
    .limit(20);

  if (input.service_name) {
    query = query.ilike("service_name", `%${input.service_name}%`);
  }
  if (input.patient_id) {
    query = query.eq("patient_id", input.patient_id as string);
  }
  if (input.status) {
    query = query.eq("status", input.status as string);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    count: (data ?? []).length,
    entries: (data ?? []).map((e) => {
      const patient = e.patient as unknown as Record<string, string> | null;
      return {
        id: e.id,
        patient_name: patient ? `${patient.first_name} ${patient.last_name}` : "N/A",
        service: e.service_name,
        provider: e.preferred_provider,
        status: e.status,
        urgency: e.clinical_urgency,
        score: e.smart_score,
        since: e.created_at,
      };
    }),
  };
}
