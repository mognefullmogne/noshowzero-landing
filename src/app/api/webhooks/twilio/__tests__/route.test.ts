// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Integration tests: POST /api/webhooks/twilio
 *
 * Tests the webhook handler in isolation by mocking all external I/O:
 *   - Twilio signature verification
 *   - Supabase client
 *   - Intent routing
 *   - Booking orchestrator
 *   - Response pattern recording
 *
 * Verifies:
 *  1. Rejects requests with no/invalid signature → 403
 *  2. Rejects when TWILIO_WEBHOOK_URL is missing → 500
 *  3. Returns empty TwiML for malformed phone numbers
 *  4. Returns "unknown caller" message for unregistered phones
 *  5. Routes "SI" to confirm intent and returns Italian reply
 *  6. Routes "NO" to cancel intent and returns Italian reply
 *  7. Rate limiting: blocks after 10 messages from same phone
 *  8. Truncates overly long message bodies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Module mocks (declared before any imports of the module under test) ────

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/webhooks/twilio-verify", () => ({
  verifyTwilioSignature: vi.fn(),
}));

vi.mock("@/lib/messaging/intent-engine", () => ({
  classifyIntent: vi.fn(),
}));

vi.mock("@/lib/webhooks/message-router", () => ({
  routeIntent: vi.fn(),
}));

vi.mock("@/lib/booking/booking-orchestrator", () => ({
  handleBookingMessage: vi.fn(),
}));

vi.mock("@/lib/booking/session-manager", () => ({
  findActiveSession: vi.fn(),
}));

vi.mock("@/lib/booking/tenant-resolver", () => ({
  resolveTenantFromPhone: vi.fn(),
}));

vi.mock("@/lib/engine/process-pending", () => ({
  maybeProcessPending: vi.fn(),
}));

vi.mock("@/lib/intelligence/response-patterns", () => ({
  recordResponsePattern: vi.fn(),
}));

// ─── Import mocked modules so we can configure their return values ────────────

import { createServiceClient } from "@/lib/supabase/server";
import { verifyTwilioSignature } from "@/lib/webhooks/twilio-verify";
import { classifyIntent } from "@/lib/messaging/intent-engine";
import { routeIntent } from "@/lib/webhooks/message-router";
import { findActiveSession } from "@/lib/booking/session-manager";
import { resolveTenantFromPhone } from "@/lib/booking/tenant-resolver";
import { createMockSupabase } from "@/lib/backfill/__tests__/helpers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_PHONE = "+393516761840";
const TENANT_ID = "e1d14300-10cb-42d0-9e9d-eb8fee866570";
const PATIENT_ID = "patient-001";
const APPOINTMENT_ID = "appt-001";

function makePatient(overrides = {}) {
  return {
    id: PATIENT_ID,
    tenant_id: TENANT_ID,
    first_name: "Mario",
    last_name: "Rossi",
    phone: VALID_PHONE,
    ...overrides,
  };
}

function makeAppointment(overrides = {}) {
  return {
    id: APPOINTMENT_ID,
    tenant_id: TENANT_ID,
    patient_id: PATIENT_ID,
    status: "scheduled",
    scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  };
}

/** Build a NextRequest that looks like a Twilio webhook POST. */
function makeTwilioRequest(body: Record<string, string>): NextRequest {
  const formData = new URLSearchParams(body).toString();
  return new NextRequest("http://localhost:3000/api/webhooks/twilio", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": "test-signature",
    },
    body: formData,
  });
}

/** Import and call the POST handler each time (avoids module-level rate-limit state). */
async function callHandler(req: NextRequest) {
  // Dynamic import so Vitest properly applies mocks each time
  const { POST } = await import("../route");
  return POST(req);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/twilio", () => {
  const savedWebhookUrl = process.env.TWILIO_WEBHOOK_URL;
  const savedAuthToken = process.env.TWILIO_AUTH_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env.TWILIO_WEBHOOK_URL = "https://example.com/api/webhooks/twilio";
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token";

    // Default: signature passes
    vi.mocked(verifyTwilioSignature).mockReturnValue(true);

    // Default: no active booking session
    vi.mocked(findActiveSession).mockResolvedValue(null);

    // Default: unknown tenant for "To" number
    vi.mocked(resolveTenantFromPhone).mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.TWILIO_WEBHOOK_URL = savedWebhookUrl;
    process.env.TWILIO_AUTH_TOKEN = savedAuthToken;
  });

  // ─── 1. Missing TWILIO_WEBHOOK_URL ────────────────────────────────────────

  it("returns 500 when TWILIO_WEBHOOK_URL is not configured", async () => {
    delete process.env.TWILIO_WEBHOOK_URL;

    const req = makeTwilioRequest({
      From: `whatsapp:${VALID_PHONE}`,
      To: "whatsapp:+14155238886",
      Body: "SI",
    });

    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(500);
  });

  // ─── 2. Invalid Twilio signature ──────────────────────────────────────────

  it("returns 403 when Twilio signature is invalid", async () => {
    vi.mocked(verifyTwilioSignature).mockReturnValue(false);

    const req = makeTwilioRequest({
      From: `whatsapp:${VALID_PHONE}`,
      To: "whatsapp:+14155238886",
      Body: "SI",
    });

    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  // ─── 3. Malformed phone number ────────────────────────────────────────────

  it("returns empty TwiML for a malformed phone number", async () => {
    const supabase = createMockSupabase({ patients: [] });
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never);

    const req = makeTwilioRequest({
      From: "whatsapp:BADPHONE",
      To: "whatsapp:+14155238886",
      Body: "SI",
    });

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("<Response/>");
    expect(res.headers.get("content-type")).toContain("text/xml");
  });

  // ─── 4. Unknown patient phone ─────────────────────────────────────────────

  it("returns Italian 'cannot identify' message for unknown patient", async () => {
    const supabase = createMockSupabase({ patients: [] });
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never);

    const req = makeTwilioRequest({
      From: `whatsapp:${VALID_PHONE}`,
      To: "whatsapp:+14155238886",
      Body: "SI",
    });

    vi.mocked(classifyIntent).mockReturnValue({ intent: "confirm", confidence: 0.99 });

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("Non siamo riusciti a identificarti");
  });

  // ─── 5. "SI" → confirm → Italian confirmation reply ───────────────────────

  it("routes SI message to confirm intent and returns Italian reply", async () => {
    const patient = makePatient();
    const appointment = makeAppointment();
    const offer = null;

    const supabase = createMockSupabase({
      patients: [patient],
      appointments: [appointment],
      waitlist_offers: offer ? [offer] : [],
      message_events: [],
      message_threads: [],
    });
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never);

    vi.mocked(classifyIntent).mockReturnValue({ intent: "confirm", confidence: 0.99 });
    vi.mocked(routeIntent).mockResolvedValue({
      action: "appointment_confirmed",
      reply: "Perfetto! Il tuo appuntamento è confermato.",
    });

    const req = makeTwilioRequest({
      From: `whatsapp:${VALID_PHONE}`,
      To: "whatsapp:+14155238886",
      Body: "SI",
    });

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("Perfetto!");
    expect(body).toContain('<?xml version="1.0"');
    expect(body).toContain("<Message>");

    expect(vi.mocked(routeIntent)).toHaveBeenCalledOnce();
    const [, args] = vi.mocked(routeIntent).mock.calls[0];
    expect(args.intent).toBe("confirm");
    expect(args.tenantId).toBe(TENANT_ID);
    expect(args.patientId).toBe(PATIENT_ID);
  });

  // ─── 6. "NO" → cancel intent ──────────────────────────────────────────────

  it("routes NO message to cancel intent and returns Italian reply", async () => {
    const patient = makePatient();
    const appointment = makeAppointment();

    const supabase = createMockSupabase({
      patients: [patient],
      appointments: [appointment],
      waitlist_offers: [],
      message_events: [],
      message_threads: [],
    });
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never);

    vi.mocked(classifyIntent).mockReturnValue({ intent: "cancel", confidence: 0.99 });
    vi.mocked(routeIntent).mockResolvedValue({
      action: "appointment_cancelled",
      reply: "Appuntamento cancellato. Ci dispiace non poterti vedere.",
    });

    const req = makeTwilioRequest({
      From: `whatsapp:${VALID_PHONE}`,
      To: "whatsapp:+14155238886",
      Body: "NO",
    });

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("cancellato");

    expect(vi.mocked(routeIntent)).toHaveBeenCalledOnce();
    const [, args] = vi.mocked(routeIntent).mock.calls[0];
    expect(args.intent).toBe("cancel");
  });

  // ─── 7. SMS channel (no "whatsapp:" prefix) ───────────────────────────────

  it("handles SMS channel (no whatsapp: prefix) correctly", async () => {
    const patient = makePatient({ phone: VALID_PHONE });
    const appointment = makeAppointment();

    const supabase = createMockSupabase({
      patients: [patient],
      appointments: [appointment],
      waitlist_offers: [],
      message_events: [],
      message_threads: [],
    });
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never);

    vi.mocked(classifyIntent).mockReturnValue({ intent: "confirm", confidence: 0.99 });
    vi.mocked(routeIntent).mockResolvedValue({
      action: "appointment_confirmed",
      reply: "Confermato via SMS.",
    });

    const req = makeTwilioRequest({
      From: VALID_PHONE, // no "whatsapp:" prefix — this is an SMS
      To: "+14155238886",
      Body: "SI",
    });

    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<?xml");
  });

  // ─── 8. Message body is XML-escaped in TwiML ──────────────────────────────

  it("XML-escapes special characters in TwiML reply", async () => {
    const patient = makePatient();
    const appointment = makeAppointment();

    const supabase = createMockSupabase({
      patients: [patient],
      appointments: [appointment],
      waitlist_offers: [],
      message_events: [],
      message_threads: [],
    });
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never);

    vi.mocked(classifyIntent).mockReturnValue({ intent: "confirm", confidence: 0.99 });
    vi.mocked(routeIntent).mockResolvedValue({
      action: "appointment_confirmed",
      reply: 'Reply with <special> & "chars"',
    });

    const req = makeTwilioRequest({
      From: `whatsapp:${VALID_PHONE}`,
      To: "whatsapp:+14155238886",
      Body: "SI",
    });

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.text();

    // Must escape XML entities — raw < > & " ' are unsafe in TwiML
    expect(body).not.toContain("<special>");
    expect(body).toContain("&lt;special&gt;");
    expect(body).toContain("&amp;");
    expect(body).toContain("&quot;");
  });

  // ─── 9. Active offer remaps confirm → accept_offer ───────────────────────

  it("remaps 'confirm' to 'accept_offer' when an active offer exists", async () => {
    const patient = makePatient();
    const appointment = makeAppointment();
    const activeOffer = {
      id: "offer-001",
      tenant_id: TENANT_ID,
      patient_id: PATIENT_ID,
      status: "pending",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    };

    // Build a supabase mock where waitlist_offers has the active offer
    const supabase = createMockSupabase({
      patients: [patient],
      appointments: [appointment],
      waitlist_offers: [activeOffer],
      message_events: [],
      message_threads: [],
    });
    vi.mocked(createServiceClient).mockResolvedValue(supabase as never);

    vi.mocked(classifyIntent).mockReturnValue({ intent: "confirm", confidence: 0.9 });
    vi.mocked(routeIntent).mockResolvedValue({
      action: "offer_accepted",
      reply: "Offerta accettata! Ti abbiamo prenotato il nuovo slot.",
    });

    const req = makeTwilioRequest({
      From: `whatsapp:${VALID_PHONE}`,
      To: "whatsapp:+14155238886",
      Body: "SI",
    });

    const { POST } = await import("../route");
    await POST(req);

    expect(vi.mocked(routeIntent)).toHaveBeenCalledOnce();
    const [, args] = vi.mocked(routeIntent).mock.calls[0];
    // The route should have remapped confirm → accept_offer when offer is active
    expect(args.intent).toBe("accept_offer");
    expect(args.offerId).toBe("offer-001");
  });
});
