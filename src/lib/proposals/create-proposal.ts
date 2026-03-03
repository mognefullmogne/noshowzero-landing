/**
 * Create a slot proposal and send it to the patient via WhatsApp.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProposedSlotOption } from "@/lib/types";
import { sendMessage } from "@/lib/messaging/send-message";

export async function createSlotProposal(
  supabase: SupabaseClient,
  tenantId: string,
  appointmentId: string,
  patientId: string,
  patientPhone: string,
  slots: readonly ProposedSlotOption[]
): Promise<{ proposalId: string } | { error: string }> {
  if (slots.length === 0) {
    return { error: "No available slots to propose" };
  }

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

  const { data: proposal, error } = await supabase
    .from("slot_proposals")
    .insert({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      patient_id: patientId,
      proposed_slots: slots,
      status: "pending",
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Build WhatsApp message with slot options
  const lines = [
    "Abbiamo trovato degli slot alternativi per il tuo appuntamento:",
    "",
  ];

  for (const slot of slots) {
    const date = new Date(slot.start_at).toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const time = new Date(slot.start_at).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    lines.push(`*${slot.index}* - ${date} alle ${time} con ${slot.provider_name}`);
  }

  lines.push("", "Rispondi con il numero (1, 2 o 3) per scegliere.");

  await sendMessage(supabase, {
    tenantId,
    patientId,
    patientPhone,
    channel: "whatsapp",
    body: lines.join("\n"),
    contextAppointmentId: appointmentId,
  });

  return { proposalId: proposal.id };
}
