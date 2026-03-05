// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMessage } from "@/lib/messaging/send-message";

export async function sendMessageToPatient(
  supabase: SupabaseClient,
  tenantId: string,
  input: Record<string, unknown>
) {
  const patientId = input.patient_id as string;
  const message = input.message as string;

  // Get patient info
  const { data: patient } = await supabase
    .from("patients")
    .select("id, first_name, last_name, phone, preferred_channel")
    .eq("id", patientId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!patient) return { error: "Paziente non trovato" };
  if (!patient.phone) return { error: "Il paziente non ha un numero di telefono" };

  const result = await sendMessage(supabase, {
    tenantId,
    patientId: patient.id,
    patientPhone: patient.phone,
    channel: patient.preferred_channel ?? "whatsapp",
    body: message,
  });

  return {
    success: result.success,
    patient_name: `${patient.first_name} ${patient.last_name}`,
    channel: patient.preferred_channel,
    error: result.error,
  };
}
