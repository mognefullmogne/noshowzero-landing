// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Send an outbound message to a patient via their preferred channel.
 * Creates or reuses a message_thread, logs message_event + delivery_status.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessageChannel, MessageEvent, MessageThread } from "@/lib/types";
import { sendNotification } from "@/lib/twilio/send-notification";
import { getTwilioWhatsAppFrom, getTwilioSmsFrom } from "@/lib/twilio/client";

interface SendMessageInput {
  readonly tenantId: string;
  readonly patientId: string;
  readonly patientPhone: string;
  readonly channel: MessageChannel;
  readonly body: string;
  readonly contextAppointmentId?: string;
  readonly contextOfferId?: string;
}

interface SendMessageResult {
  readonly success: boolean;
  readonly thread?: MessageThread;
  readonly message?: MessageEvent;
  readonly error?: string;
}

export async function sendMessage(
  supabase: SupabaseClient,
  input: SendMessageInput
): Promise<SendMessageResult> {
  // Find or create thread
  const { data: existingThread } = await supabase
    .from("message_threads")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("patient_id", input.patientId)
    .eq("channel", input.channel)
    .maybeSingle();

  let threadId: string;

  if (existingThread) {
    threadId = existingThread.id;
  } else {
    const { data: newThread, error: threadError } = await supabase
      .from("message_threads")
      .insert({
        tenant_id: input.tenantId,
        patient_id: input.patientId,
        channel: input.channel,
      })
      .select("id")
      .single();

    if (threadError || !newThread) {
      return { success: false, error: `Failed to create thread: ${threadError?.message}` };
    }
    threadId = newThread.id;
  }

  // Determine from/to numbers
  const fromNumber =
    input.channel === "whatsapp" ? getTwilioWhatsAppFrom() : getTwilioSmsFrom();
  const toNumber = input.patientPhone;

  // Send via Twilio
  const effectiveChannel = input.channel === "email" ? "sms" : input.channel;
  const sendResult = await sendNotification({
    to: toNumber,
    body: input.body,
    channel: effectiveChannel,
    tenantId: input.tenantId,
  });

  // Log message event
  const { data: messageEvent, error: msgError } = await supabase
    .from("message_events")
    .insert({
      tenant_id: input.tenantId,
      thread_id: threadId,
      direction: "outbound",
      channel: input.channel,
      body: input.body,
      from_number: fromNumber,
      to_number: toNumber,
      external_sid: sendResult.externalMessageId || null,
      context_appointment_id: input.contextAppointmentId ?? null,
      context_offer_id: input.contextOfferId ?? null,
    })
    .select("*")
    .single();

  if (msgError) {
    console.error("[Messaging] Failed to log message event:", msgError);
  }

  // Log delivery status
  if (messageEvent) {
    await supabase.from("delivery_statuses").insert({
      message_event_id: messageEvent.id,
      status: sendResult.status === "sent" ? "queued" : "failed",
      error_message: sendResult.errorMessage ?? null,
    });
  }

  // Update thread's last_message_at
  await supabase
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString(), is_resolved: false })
    .eq("id", threadId);

  // Fetch thread for return
  const { data: thread } = await supabase
    .from("message_threads")
    .select("*")
    .eq("id", threadId)
    .single();

  return {
    success: sendResult.status === "sent",
    thread: thread ?? undefined,
    message: messageEvent ?? undefined,
    error: sendResult.status === "failed" ? sendResult.errorMessage : undefined,
  };
}
