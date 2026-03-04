import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Validates the CRON_SECRET authorization header.
 * Returns null if authorized, or a NextResponse error to return immediately.
 */
export function verifyCronSecret(request: { headers: { get(name: string): string | null } }): NextResponse | null {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not set — refusing to run cron endpoint");
    return NextResponse.json({ error: "Service misconfigured" }, { status: 500 });
  }

  if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
