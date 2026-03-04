/**
 * HMAC-SHA256 token generation & verification for secure offer email/SMS links.
 * Accept and decline get separate tokens. DB stores only SHA-256 hash.
 */

import { createHmac, createHash, timingSafeEqual } from "crypto";

const OFFER_EXPIRY_HOURS = 1;

function getSecret(): string {
  const secret = process.env.OFFER_TOKEN_SECRET;
  if (!secret) throw new Error("OFFER_TOKEN_SECRET env var is required");
  return secret;
}

/**
 * Generate an HMAC token for an offer action.
 * Returns { token, tokenHash, expiresAt }.
 */
export function generateOfferToken(
  offerId: string,
  action: "accept" | "decline"
): { token: string; tokenHash: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + OFFER_EXPIRY_HOURS * 3_600_000);
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
