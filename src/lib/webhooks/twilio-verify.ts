/**
 * Validate Twilio X-Twilio-Signature for webhook security.
 * Uses twilio.validateRequest() to prevent spoofed webhook calls.
 */

import Twilio from "twilio";

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn("[Twilio] No auth token configured — skipping signature verification in dev");
    return process.env.NODE_ENV === "development";
  }

  return Twilio.validateRequest(authToken, signature, url, params);
}
