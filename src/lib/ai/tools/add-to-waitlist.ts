// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function addToWaitlist(
  supabase: SupabaseClient,
  tenantId: string,
  input: Record<string, unknown>
) {
  const patientId = input.patient_id as string;
  const serviceName = input.service_name as string;

  // Verify patient exists
  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .eq("id", patientId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!patient) return { error: "Paziente non trovato" };

  const { data, error } = await supabase
    .from("waitlist_entries")
    .insert({
      tenant_id: tenantId,
      patient_id: patientId,
      service_name: serviceName,
      preferred_provider: (input.preferred_provider as string) ?? null,
      clinical_urgency: (input.clinical_urgency as string) ?? "none",
      status: "waiting",
      priority_score: 50,
      flexible_time: true,
    })
    .select("id, status")
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    waitlist_entry_id: data.id,
    patient_name: `${patient.first_name} ${patient.last_name}`,
    service: serviceName,
  };
}
