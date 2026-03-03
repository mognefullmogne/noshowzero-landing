/**
 * Route classified intents to appropriate handlers.
 * Each intent maps to a specific business action.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessageIntent } from "@/lib/types";
import { processAccept, processDecline } from "@/lib/backfill/process-response";

interface RouteInput {
  readonly tenantId: string;
  readonly patientId: string;
  readonly threadId: string;
  readonly intent: MessageIntent;
  readonly confidence: number;
  readonly messageBody: string;
  readonly appointmentId?: string;
  readonly offerId?: string;
}

interface RouteResult {
  readonly reply: string;
  readonly action?: string;
}

export async function routeIntent(
  supabase: SupabaseClient,
  input: RouteInput
): Promise<RouteResult> {
  switch (input.intent) {
    case "confirm":
      return handleConfirm(supabase, input);
    case "cancel":
      return handleCancel(supabase, input);
    case "accept_offer":
      return handleAcceptOffer(supabase, input);
    case "decline_offer":
      return handleDeclineOffer(supabase, input);
    case "slot_select":
      return handleSlotSelect(supabase, input);
    case "question":
      return handleQuestion(input);
    default:
      return handleUnknown(input);
  }
}

async function handleConfirm(
  supabase: SupabaseClient,
  input: RouteInput
): Promise<RouteResult> {
  if (!input.appointmentId) {
    return { reply: "Non riesco a trovare un appuntamento da confermare. Puoi contattare la segreteria per assistenza." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", input.appointmentId)
    .eq("tenant_id", input.tenantId)
    .in("status", ["scheduled", "reminder_sent", "reminder_pending"]);

  if (error) {
    console.error("[Router] Confirm failed:", error);
    return { reply: "Si e' verificato un errore. Riprova o contatta la segreteria." };
  }

  // Update confirmation workflow if exists
  await supabase
    .from("confirmation_workflows")
    .update({ state: "confirmed" })
    .eq("appointment_id", input.appointmentId)
    .eq("tenant_id", input.tenantId)
    .in("state", ["pending_send", "message_sent"]);

  return {
    reply: "Perfetto! Il tuo appuntamento e' confermato. Ti aspettiamo!",
    action: "appointment_confirmed",
  };
}

async function handleCancel(
  supabase: SupabaseClient,
  input: RouteInput
): Promise<RouteResult> {
  if (!input.appointmentId) {
    return { reply: "Non riesco a trovare un appuntamento da cancellare. Puoi contattare la segreteria per assistenza." };
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      declined_at: new Date().toISOString(),
    })
    .eq("id", input.appointmentId)
    .eq("tenant_id", input.tenantId)
    .in("status", ["scheduled", "reminder_sent", "reminder_pending", "confirmed"]);

  if (error) {
    console.error("[Router] Cancel failed:", error);
    return { reply: "Si e' verificato un errore. Riprova o contatta la segreteria." };
  }

  // Update confirmation workflow
  await supabase
    .from("confirmation_workflows")
    .update({ state: "declined" })
    .eq("appointment_id", input.appointmentId)
    .eq("tenant_id", input.tenantId)
    .in("state", ["pending_send", "message_sent"]);

  return {
    reply: "Il tuo appuntamento e' stato cancellato. Se desideri riprogrammare, contatta la segreteria.",
    action: "appointment_cancelled",
  };
}

async function handleAcceptOffer(
  supabase: SupabaseClient,
  input: RouteInput
): Promise<RouteResult> {
  if (!input.offerId) {
    return { reply: "Non ho trovato un'offerta attiva. Contatta la segreteria per assistenza." };
  }

  const result = await processAccept(supabase, input.offerId);
  if (!result.success) {
    return { reply: `Non e' stato possibile accettare l'offerta: ${result.error}. Contatta la segreteria.` };
  }

  return {
    reply: "Ottimo! Hai accettato lo slot. Il tuo nuovo appuntamento e' confermato. Ti aspettiamo!",
    action: "offer_accepted",
  };
}

async function handleDeclineOffer(
  supabase: SupabaseClient,
  input: RouteInput
): Promise<RouteResult> {
  if (!input.offerId) {
    return { reply: "Non ho trovato un'offerta attiva. Contatta la segreteria per assistenza." };
  }

  const result = await processDecline(supabase, input.offerId);
  if (!result.success) {
    return { reply: `Si e' verificato un errore: ${result.error}. Contatta la segreteria.` };
  }

  return {
    reply: "Nessun problema. Se cambi idea, contatta la segreteria.",
    action: "offer_declined",
  };
}

async function handleSlotSelect(
  supabase: SupabaseClient,
  input: RouteInput
): Promise<RouteResult> {
  // Extract slot number from message (1, 2, or 3)
  const match = input.messageBody.match(/[123]/);
  if (!match) {
    return { reply: "Per favore rispondi con 1, 2 o 3 per selezionare uno slot." };
  }

  const selectedIndex = parseInt(match[0], 10);

  // Find active slot proposal for this patient
  const { data: proposal } = await supabase
    .from("slot_proposals")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("patient_id", input.patientId)
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!proposal) {
    return { reply: "Non ho trovato una proposta attiva. Contatta la segreteria." };
  }

  const slots = proposal.proposed_slots as Array<{ index: number; slot_id: string; start_at: string }>;
  const selected = slots.find((s) => s.index === selectedIndex);
  if (!selected) {
    return { reply: "Opzione non valida. Per favore scegli 1, 2 o 3." };
  }

  // Update proposal
  await supabase
    .from("slot_proposals")
    .update({
      selected_index: selectedIndex,
      selected_slot_id: selected.slot_id,
      status: "selected",
    })
    .eq("id", proposal.id);

  return {
    reply: `Perfetto! Hai selezionato l'opzione ${selectedIndex}. Il tuo appuntamento e' confermato.`,
    action: "slot_selected",
  };
}

function handleQuestion(input: RouteInput): RouteResult {
  return {
    reply: "Grazie per il tuo messaggio. Un operatore ti rispondera' al piu' presto. Per urgenze, chiama direttamente la segreteria.",
    action: "question_forwarded",
  };
}

function handleUnknown(input: RouteInput): RouteResult {
  return {
    reply: "Non ho capito il tuo messaggio. Rispondi SI per confermare o NO per cancellare. Per altre richieste, contatta la segreteria.",
  };
}
