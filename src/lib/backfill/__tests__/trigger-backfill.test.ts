import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";
import { createMockSupabase } from "./helpers";
import type { RankedCandidate } from "@/lib/backfill/find-candidates";

// ---------------------------------------------------------------------------
// Module-level mocks for findCandidates and sendOffer
// ---------------------------------------------------------------------------

vi.mock("@/lib/backfill/find-candidates", () => ({
  findCandidates: vi.fn(),
}));

vi.mock("@/lib/backfill/send-offer", () => ({
  sendOffer: vi.fn(),
}));

import { findCandidates } from "@/lib/backfill/find-candidates";
import { sendOffer } from "@/lib/backfill/send-offer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = "tenant-001";
const APPOINTMENT_ID = "appt-cancelled";
const PATIENT_ID = "pat-canceller";

// Slot 3 days in the future (well above 2-hr limit)
const FUTURE_SLOT = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString();

/** Build a cancelled appointment row. */
function makeAppointment(overrides: Partial<{
  id: string;
  tenant_id: string;
  patient_id: string;
  status: string;
  scheduled_at: string;
  duration_min: number;
  service_name: string;
  provider_name: string | null;
  location_name: string | null;
}> = {}) {
  return {
    id: APPOINTMENT_ID,
    tenant_id: TENANT_ID,
    patient_id: PATIENT_ID,
    status: "cancelled",
    scheduled_at: FUTURE_SLOT,
    duration_min: 60,
    service_name: "General Checkup",
    provider_name: "Dr. Rossi",
    location_name: "Rome Clinic",
    ...overrides,
  };
}

/** Build a minimal RankedCandidate. */
function makeCandidate(overrides: Partial<RankedCandidate> = {}): RankedCandidate {
  return {
    candidateAppointmentId: "appt-candidate-001",
    patientId: "pat-candidate",
    patientName: "Maria Bianchi",
    patientPhone: "+391234567890",
    patientEmail: null,
    preferredChannel: "whatsapp",
    candidateScore: { total: 80, appointmentDistance: 60, reliability: 20 },
    currentAppointmentAt: new Date(Date.now() + 30 * 24 * 3_600_000),
    ...overrides,
  };
}

describe("triggerBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Fetches cancelled appointment and calls findCandidates with cancellingPatientId
  // ---------------------------------------------------------------------------
  it("fetches cancelled appointment and calls findCandidates with cancellingPatientId", async () => {
    const appointment = makeAppointment();
    const candidate = makeCandidate();

    const supabase = createMockSupabase({
      appointments: [appointment],
      waitlist_offers: [], // no existing offers
    });

    vi.mocked(findCandidates).mockResolvedValue([candidate]);
    vi.mocked(sendOffer).mockResolvedValue({ offerId: "offer-001", status: "sent" });

    await triggerBackfill(supabase, APPOINTMENT_ID, TENANT_ID);

    expect(findCandidates).toHaveBeenCalledOnce();
    const [, slot] = vi.mocked(findCandidates).mock.calls[0];
    expect(slot.cancellingPatientId).toBe(PATIENT_ID);
    expect(slot.appointmentId).toBe(APPOINTMENT_ID);
    expect(slot.tenantId).toBe(TENANT_ID);
  });

  // ---------------------------------------------------------------------------
  // 2. Passes cancellingPatientId to findCandidates for exclusion
  // ---------------------------------------------------------------------------
  it("passes cancellingPatientId to findCandidates for exclusion", async () => {
    const customPatientId = "pat-custom-canceller";
    const appointment = makeAppointment({ patient_id: customPatientId });
    const candidate = makeCandidate();

    const supabase = createMockSupabase({
      appointments: [appointment],
      waitlist_offers: [],
    });

    vi.mocked(findCandidates).mockResolvedValue([candidate]);
    vi.mocked(sendOffer).mockResolvedValue({ offerId: "offer-002", status: "sent" });

    await triggerBackfill(supabase, APPOINTMENT_ID, TENANT_ID);

    expect(findCandidates).toHaveBeenCalledOnce();
    const [, slot] = vi.mocked(findCandidates).mock.calls[0];
    // The cancelling patient's ID must be passed so findCandidates can exclude them
    expect(slot.cancellingPatientId).toBe(customPatientId);
    // Old fields must NOT be passed to findCandidates (they don't exist on OpenSlotDetails)
    expect((slot as Record<string, unknown>).serviceName).toBeUndefined();
    expect((slot as Record<string, unknown>).serviceCode).toBeUndefined();
    expect((slot as Record<string, unknown>).providerName).toBeUndefined();
    expect((slot as Record<string, unknown>).locationName).toBeUndefined();
    expect((slot as Record<string, unknown>).paymentCategory).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 3. Skips if appointment is not cancelled or no_show
  // ---------------------------------------------------------------------------
  it("skips if appointment is not cancelled or no_show", async () => {
    const appointment = makeAppointment({ status: "confirmed" });

    const supabase = createMockSupabase({
      appointments: [appointment],
      waitlist_offers: [],
    });

    const result = await triggerBackfill(supabase, APPOINTMENT_ID, TENANT_ID);

    expect(result).toBeNull();
    expect(findCandidates).not.toHaveBeenCalled();
    expect(sendOffer).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 4. Skips if active offer already exists for this slot
  // ---------------------------------------------------------------------------
  it("skips if active offer already exists for this slot", async () => {
    const appointment = makeAppointment();
    const existingOffer = {
      id: "offer-existing",
      original_appointment_id: APPOINTMENT_ID,
      status: "pending",
      tenant_id: TENANT_ID,
    };

    const supabase = createMockSupabase({
      appointments: [appointment],
      waitlist_offers: [existingOffer],
    });

    const result = await triggerBackfill(supabase, APPOINTMENT_ID, TENANT_ID);

    expect(result).toBeNull();
    expect(findCandidates).not.toHaveBeenCalled();
    expect(sendOffer).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 5. Sends offer to top-ranked candidate
  // ---------------------------------------------------------------------------
  it("sends offer to top-ranked candidate", async () => {
    const appointment = makeAppointment();
    const topCandidate = makeCandidate({
      candidateAppointmentId: "appt-top",
      patientId: "pat-top",
      candidateScore: { total: 100, appointmentDistance: 60, reliability: 40 },
    });
    const secondCandidate = makeCandidate({
      candidateAppointmentId: "appt-second",
      patientId: "pat-second",
      candidateScore: { total: 60, appointmentDistance: 40, reliability: 20 },
    });

    const supabase = createMockSupabase({
      appointments: [appointment],
      waitlist_offers: [],
    });

    vi.mocked(findCandidates).mockResolvedValue([topCandidate, secondCandidate]);
    vi.mocked(sendOffer).mockResolvedValue({ offerId: "offer-top", status: "sent" });

    const result = await triggerBackfill(supabase, APPOINTMENT_ID, TENANT_ID);

    expect(result).toBe("offer-top");
    expect(sendOffer).toHaveBeenCalledOnce();
    const [, input] = vi.mocked(sendOffer).mock.calls[0];
    // Must send to top-ranked candidate
    expect(input.candidate.patientId).toBe("pat-top");
    expect(input.candidate.candidateAppointmentId).toBe("appt-top");
    expect(input.originalAppointmentId).toBe(APPOINTMENT_ID);
    expect(input.tenantId).toBe(TENANT_ID);
  });
});
