/**
 * POST /api/webhooks/twilio — Inbound WhatsApp/SMS webhook.
 * Public endpoint (no session auth) — verified via Twilio signature.
 * Parses inbound message, stores event, classifies intent, routes, returns TwiML.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyTwilioSignature } from "@/lib/webhooks/twilio-verify";
import { handlePatientMessage } from "@/lib/messaging/patient-bot";
import { sendMessage } from "@/lib/messaging/send-message";
import type { MessageChannel } from "@/lib/types";

export async function POST(request: NextRequest) {
  // Parse Twilio form body
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  // Verify Twilio signature
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL ?? request.url;

  if (!verifyTwilioSignature(webhookUrl, params, signature)) {
    console.error("[Webhook] Invalid Twilio signature");
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = params.Body ?? "";
  const from = params.From ?? "";
  const to = params.To ?? "";

  if (!body || !from) {
    return twimlResponse("");
  }

  // Determine channel from From number format
  const channel: MessageChannel = from.startsWith("whatsapp:") ? "whatsapp" : "sms";
  const phoneNumber = from.replace(/^whatsapp:/, "");

  const supabase = await createServiceClient();

  // Find patient by phone number
  const { data: patient } = await supabase
    .from("patients")
    .select("id, tenant_id, first_name, last_name, phone")
    .or(`phone.eq.${phoneNumber},phone.eq.${from}`)
    .limit(1)
    .maybeSingle();

  if (!patient) {
    console.warn(`[Webhook] Unknown patient phone: ${phoneNumber}`);
    return twimlResponse("Non siamo riusciti a identificarti. Contatta la segreteria per assistenza.");
  }

  // Find or create thread
  const { data: thread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("tenant_id", patient.tenant_id)
    .eq("patient_id", patient.id)
    .eq("channel", channel)
    .maybeSingle();

  let threadId: string;
  if (thread) {
    threadId = thread.id;
  } else {
    const { data: newThread } = await supabase
      .from("message_threads")
      .insert({
        tenant_id: patient.tenant_id,
        patient_id: patient.id,
        channel,
      })
      .select("id")
      .single();
    threadId = newThread?.id ?? "";
  }

  if (!threadId) {
    return twimlResponse("");
  }

  // Store inbound message event
  const { data: messageEvent } = await supabase
    .from("message_events")
    .insert({
      tenant_id: patient.tenant_id,
      thread_id: threadId,
      direction: "inbound",
      channel,
      body,
      from_number: from,
      to_number: to,
    })
    .select("id")
    .single();

  // Update thread last_message_at
  await supabase
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString(), is_resolved: false })
    .eq("id", threadId);

  // Process with patient bot
  const botResult = await handlePatientMessage(supabase, {
    tenantId: patient.tenant_id,
    patientId: patient.id,
    patientPhone: phoneNumber,
    threadId,
    messageBody: body,
  });

  // Update message event with classified intent
  if (messageEvent) {
    await supabase
      .from("message_events")
      .update({
        intent: botResult.intent,
        intent_confidence: botResult.confidence,
        intent_source: botResult.confidence > 0 ? "regex" : "ai",
      })
      .eq("id", messageEvent.id);
  }

  // Send reply via messaging module (also logs outbound message)
  if (botResult.reply) {
    await sendMessage(supabase, {
      tenantId: patient.tenant_id,
      patientId: patient.id,
      patientPhone: phoneNumber,
      channel,
      body: botResult.reply,
    });
  }

  // Return empty TwiML (we send replies via API, not TwiML)
  return twimlResponse("");
}

function twimlResponse(message: string): NextResponse {
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
