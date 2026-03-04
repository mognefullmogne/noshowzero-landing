/**
 * Validate Twilio X-Twilio-Signature for webhook security.
 * Fails closed — never accepts unsigned requests regardless of environment.
 */

import Twilio from "twilio";

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("[Twilio] TWILIO_AUTH_TOKEN is not configured — rejecting request");
    return false;
  }
  if (!signature) {
    console.error("[Twilio] Missing X-Twilio-Signature header");
    return false;
  }

  const result = Twilio.validateRequest(authToken, signature, url, params);
  if (!result) {
    console.error(
      `[Twilio] Signature validation FAILED\n` +
      `  Expected URL  : ${url}\n` +
      `  Signature     : ${signature.slice(0, 8)}...\n` +
      `  Auth token ok : ${authToken.length > 0}\n` +
      `  Param keys    : ${Object.keys(params).join(", ")}`
    );
  }
  return result;
}
