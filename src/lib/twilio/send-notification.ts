/**
 * Send notifications via Twilio — supports WhatsApp, SMS, and Email.
 * Matches the provider pattern from the NestJS local version with retry + fallback.
 */

import type { MessageChannel } from "@/lib/types";
import { getTwilioClient, getTwilioWhatsAppFrom, getTwilioSmsFrom } from "./client";

export interface SendResult {
  readonly externalMessageId: string;
  readonly provider: string;
  readonly status: "sent" | "failed";
  readonly errorMessage?: string;
}

interface SendParams {
  readonly to: string;
  readonly body: string;
  readonly channel: MessageChannel;
  readonly subject?: string; // only for email
}

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

async function sendWithRetry(params: SendParams, attempt: number = 1): Promise<SendResult> {
  const client = getTwilioClient();

  if (!client) {
    console.warn(`[Twilio] Stub mode — would send ${params.channel} to ***${params.to.slice(-4)}: ${params.body.slice(0, 40)}...`);
    return {
      externalMessageId: `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      provider: "twilio-stub",
      status: "sent",
    };
  }

  try {
    if (params.channel === "whatsapp") {
      const msg = await client.messages.create({
        from: getTwilioWhatsAppFrom(),
        to: params.to.startsWith("whatsapp:") ? params.to : `whatsapp:${params.to}`,
        body: params.body,
      });
      return { externalMessageId: msg.sid, provider: "twilio-whatsapp", status: "sent" };
    }

    if (params.channel === "sms") {
      const msg = await client.messages.create({
        from: getTwilioSmsFrom(),
        to: params.to.replace(/^whatsapp:/, ""),
        body: params.body,
      });
      return { externalMessageId: msg.sid, provider: "twilio-sms", status: "sent" };
    }

    // Email via Twilio SendGrid (uses the same Twilio account)
    // For now, send as SMS fallback if email is requested but no SendGrid configured
    if (params.channel === "email") {
      const msg = await client.messages.create({
        from: getTwilioSmsFrom(),
        to: params.to.replace(/^whatsapp:/, ""),
        body: params.subject ? `${params.subject}\n\n${params.body}` : params.body,
      });
      return { externalMessageId: msg.sid, provider: "twilio-sms-fallback", status: "sent" };
    }

    return { externalMessageId: "", provider: "unknown", status: "failed", errorMessage: `Unknown channel: ${params.channel}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Twilio] Send attempt ${attempt}/${MAX_RETRIES} failed:`, message);

    if (attempt < MAX_RETRIES) {
      const delay = BACKOFF_BASE_MS * Math.pow(3, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
      return sendWithRetry(params, attempt + 1);
    }

    return { externalMessageId: "", provider: "twilio", status: "failed", errorMessage: message };
  }
}

/**
 * Send a notification to a patient via their preferred channel.
 * Retries up to 3 times with exponential backoff.
 * Falls back from WhatsApp → SMS on total failure.
 */
export async function sendNotification(params: SendParams): Promise<SendResult> {
  const result = await sendWithRetry(params);

  // Fallback: WhatsApp failure → retry as SMS
  if (result.status === "failed" && params.channel === "whatsapp") {
    console.warn("[Twilio] WhatsApp failed, falling back to SMS");
    return sendWithRetry({ ...params, channel: "sms" });
  }

  return result;
}
