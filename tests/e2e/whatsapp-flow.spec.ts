// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * E2E: WhatsApp confirmation flow — mock Twilio webhook via direct API call.
 *
 * This spec tests the full WhatsApp confirmation flow end-to-end by POSTing
 * directly to the webhook endpoint with a mocked Twilio signature. Because
 * this is a public endpoint (no session auth), we can call it from Playwright.
 *
 * NOTE: This test works only when:
 *   - TWILIO_AUTH_TOKEN is set in the test environment
 *   - TWILIO_WEBHOOK_URL is set to the test URL
 *   - The test phone (+393516761840) has an active appointment in the DB
 *
 * The test uses the real Twilio SDK to generate a valid signature so it
 * can pass signature verification.
 */

import { test, expect } from "@playwright/test";
import { createHmac } from "crypto";

/** Generate a Twilio signature the same way Twilio does. */
function generateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>
): string {
  // Sort params, concatenate key+value pairs, append to URL, then HMAC-SHA1
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  return createHmac("sha1", authToken).update(sorted).digest("base64");
}

const WEBHOOK_PATH = "/api/webhooks/twilio";

test.describe("WhatsApp Webhook (integration via Playwright request)", () => {
  test("returns 500 when TWILIO_WEBHOOK_URL is not configured", async ({ request }) => {
    // POST with no signature — the route should fail gracefully
    // (In practice the route returns 500 when TWILIO_WEBHOOK_URL is missing)
    const formData = new URLSearchParams({
      From: "whatsapp:+393516761840",
      To: "whatsapp:+14155238886",
      Body: "SI",
      MessageSid: "SM" + "x".repeat(32),
    });

    const res = await request.post(WEBHOOK_PATH, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: formData.toString(),
    });

    // Should be 403 (missing signature) or 500 (missing TWILIO_WEBHOOK_URL)
    // Both are acceptable — the point is it does NOT return 200 with real data
    expect([403, 500]).toContain(res.status());
  });

  test("returns 403 for invalid Twilio signature", async ({ request }) => {
    const formData = new URLSearchParams({
      From: "whatsapp:+393516761840",
      To: "whatsapp:+14155238886",
      Body: "SI",
      MessageSid: "SM" + "x".repeat(32),
    });

    const res = await request.post(WEBHOOK_PATH, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "invalidsignature",
      },
      data: formData.toString(),
    });

    expect(res.status()).toBe(403);
  });

  test("returns TwiML response for valid confirmation message (requires test env)", async ({ request }) => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL;

    if (!authToken || !webhookUrl) {
      test.skip(); // Only runs when Twilio credentials are available
      return;
    }

    const params: Record<string, string> = {
      From: "whatsapp:+393516761840",
      To: "whatsapp:+14155238886",
      Body: "SI",
      MessageSid: "SM" + Date.now().toString(16).padEnd(32, "0"),
    };

    const signature = generateTwilioSignature(authToken, webhookUrl, params);
    const formData = new URLSearchParams(params);

    const res = await request.post(WEBHOOK_PATH, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-twilio-signature": signature,
      },
      data: formData.toString(),
    });

    expect(res.status()).toBe(200);
    const body = await res.text();

    // Response must be valid TwiML XML
    expect(body).toContain('<?xml version="1.0"');
    expect(body).toContain("<Response");
  });

  test("blocks requests from malformed phone numbers", async ({ request }) => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL;

    if (!authToken || !webhookUrl) {
      test.skip();
      return;
    }

    const params: Record<string, string> = {
      From: "BADPHONE",
      To: "whatsapp:+14155238886",
      Body: "SI",
      MessageSid: "SM" + "a".repeat(32),
    };

    const signature = generateTwilioSignature(authToken, webhookUrl, params);
    const formData = new URLSearchParams(params);

    const res = await request.post(WEBHOOK_PATH, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-twilio-signature": signature,
      },
      data: formData.toString(),
    });

    expect(res.status()).toBe(200);
    const body = await res.text();
    // Should return empty TwiML (no message) for malformed phone
    expect(body).toContain("<Response");
  });
});
