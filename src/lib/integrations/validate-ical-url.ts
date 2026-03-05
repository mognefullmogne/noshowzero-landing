// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * iCal URL validation with SSRF protection.
 * Blocks private IPs, reserved ranges, and non-HTTP(S) schemes.
 */

import dns from "dns/promises";

const BLOCKED_IP_PATTERNS = [
  /^127\./,                           // loopback
  /^10\./,                            // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./,      // RFC1918
  /^192\.168\./,                      // RFC1918
  /^169\.254\./,                      // link-local / AWS IMDS
  /^0\./,                             // current network
  /^::1$/,                            // IPv6 loopback
  /^fc00:/i,                          // IPv6 ULA
  /^fe80:/i,                          // IPv6 link-local
  /^fd/i,                             // IPv6 ULA
];

export async function validateICalUrl(raw: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Formato URL non valido");
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Solo URL http:// e https:// sono consentiti");
  }

  // Block localhost hostnames
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("URL non consentito: host locale o interno");
  }

  // Resolve DNS and block private/internal IPs
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const { address } of addresses) {
      if (BLOCKED_IP_PATTERNS.some((pattern) => pattern.test(address))) {
        throw new Error("URL non consentito: indirizzo IP privato o riservato");
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("URL non consentito")) {
      throw err;
    }
    throw new Error("Impossibile risolvere il nome host");
  }

  return parsed.toString();
}
