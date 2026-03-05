// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

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
    return false;
  }

  const valid = Twilio.validateRequest(authToken, signature, url, params);
  if (!valid) {
    console.error("[Twilio] Signature mismatch — url used for verify:", url);
  }
  return valid;
}
