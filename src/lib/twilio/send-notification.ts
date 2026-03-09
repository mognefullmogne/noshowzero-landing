// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Send notifications via Twilio — supports WhatsApp, SMS, and Email.
 * Matches the provider pattern from the NestJS local version with retry + fallback.
 */

import type { MessageChannel } from "@/lib/types";
import { getTwilioClient, getTwilioWhatsAppFrom, getTwilioSmsFrom } from "./client";
import { MESSAGING_SERVICE_SID } from "./content-templates";

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
  readonly tenantId?: string;
  /** Twilio Content SID for WhatsApp templates (uses template instead of body). */
  readonly contentSid?: string;
  /** JSON-encoded template variables e.g. '{"1":"Marco","2":"Taglio"}'. */
  readonly contentVariables?: string;
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
    const statusCallback = process.env.TWILIO_WEBHOOK_URL || undefined;
    const effectiveTo = params.to.replace(/^whatsapp:/, "");

    if (params.channel === "whatsapp") {
      const whatsappPayload = params.contentSid
        ? {
            messagingServiceSid: MESSAGING_SERVICE_SID,
            to: `whatsapp:${effectiveTo}`,
            contentSid: params.contentSid,
            contentVariables: params.contentVariables,
            ...(statusCallback && { statusCallback }),
          }
        : {
            from: getTwilioWhatsAppFrom(),
            to: `whatsapp:${effectiveTo}`,
            body: params.body,
            ...(statusCallback && { statusCallback }),
          };
      const msg = await client.messages.create(whatsappPayload);
      return { externalMessageId: msg.sid, provider: "twilio-whatsapp", status: "sent" };
    }

    if (params.channel === "sms") {
      const msg = await client.messages.create({
        from: getTwilioSmsFrom(),
        to: effectiveTo,
        body: params.body,
        ...(statusCallback && { statusCallback }),
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

  // Fallback: WhatsApp failure → retry as SMS (strip Content SID — templates are WhatsApp-only)
  if (result.status === "failed" && params.channel === "whatsapp") {
    console.warn("[Twilio] WhatsApp failed, falling back to SMS");
    const { contentSid: _, contentVariables: __, ...smsParams } = params;
    return sendWithRetry({ ...smsParams, channel: "sms" });
  }

  return result;
}
