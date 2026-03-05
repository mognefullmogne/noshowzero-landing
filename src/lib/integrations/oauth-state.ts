// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * HMAC-based OAuth state parameter for CSRF prevention.
 * State = base64(tenantId:timestamp:hmac)
 */

import { createHmac, timingSafeEqual } from "crypto";

const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET ?? process.env.OFFER_TOKEN_SECRET;
  if (!secret) throw new Error("OAUTH_STATE_SECRET (or OFFER_TOKEN_SECRET) is required for OAuth state");
  return secret;
}

export function createOAuthState(tenantId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${tenantId}:${timestamp}`;
  const hmac = createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export function verifyOAuthState(
  state: string
): { valid: true; tenantId: string } | { valid: false } {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return { valid: false };

    const [tenantId, timestamp, receivedHmac] = parts;
    const payload = `${tenantId}:${timestamp}`;
    const expectedHmac = createHmac("sha256", getSecret())
      .update(payload)
      .digest("hex");

    const receivedBuf = Buffer.from(receivedHmac, "hex");
    const expectedBuf = Buffer.from(expectedHmac, "hex");
    if (
      receivedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(receivedBuf, expectedBuf)
    ) {
      return { valid: false };
    }

    const age = Date.now() - parseInt(timestamp, 10);
    if (age > MAX_AGE_MS) return { valid: false };

    return { valid: true, tenantId };
  } catch {
    return { valid: false };
  }
}
