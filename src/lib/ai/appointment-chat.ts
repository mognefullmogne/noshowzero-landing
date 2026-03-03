/**
 * Thin wrapper around operator-chat that pre-loads appointment context.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, ChatResult } from "@/lib/types";
import { runOperatorChat } from "./operator-chat";

export async function runAppointmentChat(
  supabase: SupabaseClient,
  tenantId: string,
  appointmentId: string,
  userMessage: string,
  history: readonly ChatMessage[]
): Promise<ChatResult> {
  // Pre-load appointment context
  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, patient:patients(first_name, last_name, phone, email)")
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!appointment) {
    return {
      response: "Appuntamento non trovato.",
      tool_calls: [],
      tokens_used: 0,
    };
  }

  const patient = appointment.patient as Record<string, string> | null;
  const contextPrefix = [
    `[Contesto: Appuntamento ${appointment.id}]`,
    `Paziente: ${patient?.first_name} ${patient?.last_name}`,
    `Servizio: ${appointment.service_name}`,
    `Data: ${new Date(appointment.scheduled_at).toLocaleString("it-IT")}`,
    `Stato: ${appointment.status}`,
    `Rischio: ${appointment.risk_score ?? "N/A"}`,
    "",
    `Domanda dell'operatore: ${userMessage}`,
  ].join("\n");

  return runOperatorChat(supabase, tenantId, contextPrefix, history);
}
