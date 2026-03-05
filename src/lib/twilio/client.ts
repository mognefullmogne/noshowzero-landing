// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Twilio client singleton — mirrors the pattern used in the NestJS local version.
 * Supports WhatsApp, SMS, and Email channels via Twilio.
 */

import Twilio from "twilio";

let _client: ReturnType<typeof Twilio> | null = null;

export function getTwilioClient() {
  if (_client) return _client;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.warn("[Twilio] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN — running in stub mode");
    return null;
  }

  _client = Twilio(accountSid, authToken);
  return _client;
}

export function getTwilioWhatsAppFrom(): string {
  return process.env.TWILIO_WHATSAPP_NUMBER ?? "whatsapp:+14155238886";
}

export function getTwilioSmsFrom(): string {
  return process.env.TWILIO_SMS_NUMBER ?? "+14155238886";
}
