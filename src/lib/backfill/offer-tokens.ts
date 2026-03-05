// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * HMAC-SHA256 token generation & verification for secure offer email/SMS links.
 * Accept and decline get separate tokens. DB stores only SHA-256 hash.
 *
 * Supports variable expiry durations for time-aware cascade speed.
 */

import { createHmac, createHash, timingSafeEqual } from "crypto";

/** Default expiry when no explicit duration is provided. */
const DEFAULT_EXPIRY_MINUTES = 60;

function getSecret(): string {
  const secret = process.env.OFFER_TOKEN_SECRET;
  if (!secret) throw new Error("OFFER_TOKEN_SECRET env var is required");
  return secret;
}

/**
 * Generate an HMAC token for an offer action.
 * Returns { token, tokenHash, expiresAt }.
 *
 * @param offerId - The offer UUID
 * @param action - "accept" or "decline"
 * @param expiryMinutes - Custom expiry in minutes (default: 60)
 */
export function generateOfferToken(
  offerId: string,
  action: "accept" | "decline",
  expiryMinutes?: number
): { token: string; tokenHash: string; expiresAt: Date } {
  const effectiveExpiry = expiryMinutes ?? DEFAULT_EXPIRY_MINUTES;
  const expiresAt = new Date(Date.now() + effectiveExpiry * 60_000);
  const payload = `${offerId}:${action}:${expiresAt.getTime()}`;
  const signature = createHmac("sha256", getSecret()).update(payload).digest("hex");
  const token = `${payload}:${signature}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  return { token, tokenHash, expiresAt };
}

/**
 * Verify an HMAC token and extract its parts.
 * Returns null if invalid or expired.
 */
export function verifyOfferToken(
  token: string
): { offerId: string; action: "accept" | "decline"; expiresAt: Date } | null {
  const parts = token.split(":");
  if (parts.length !== 4) return null;

  const [offerId, action, expiresStr, providedSig] = parts;
  if (action !== "accept" && action !== "decline") return null;

  const expiresAt = new Date(Number(expiresStr));
  if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) return null;

  const payload = `${offerId}:${action}:${expiresStr}`;
  const expectedSig = createHmac("sha256", getSecret()).update(payload).digest("hex");

  const sigA = Buffer.from(providedSig, "hex");
  const sigB = Buffer.from(expectedSig, "hex");
  if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) return null;

  return { offerId, action, expiresAt };
}

/**
 * Hash a raw token for DB storage comparison.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
