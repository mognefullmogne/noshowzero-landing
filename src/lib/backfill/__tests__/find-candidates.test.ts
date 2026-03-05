// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { describe, it, expect } from "vitest";
import { findCandidates, type OpenSlotDetails } from "@/lib/backfill/find-candidates";
import { createMockSupabase } from "./helpers";

// ---------------------------------------------------------------------------
// Fixed test time anchor: open slot is 3 days from "now" (well above 2-hr limit)
// ---------------------------------------------------------------------------
const OPEN_SLOT_AT = new Date("2026-04-04T10:00:00Z"); // 3 days in future

const TENANT_ID = "tenant-001";
const CANCELLING_PATIENT_ID = "pat-canceller";

const BASE_SLOT: OpenSlotDetails = {
  appointmentId: "appt-cancelled",
  tenantId: TENANT_ID,
  cancellingPatientId: CANCELLING_PATIENT_ID,
  scheduledAt: OPEN_SLOT_AT,
  durationMin: 60,
};

/** Build a minimal appointment row (joined with patient). */
function makeAppt(overrides: {
  id: string;
  patient_id: string;
  scheduled_at: string;
  duration_min?: number;
  status?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  preferred_channel?: string;
}) {
  const {
    id,
    patient_id,
    scheduled_at,
    duration_min = 60,
    status = "scheduled",
    first_name = "Test",
    last_name = "Patient",
    phone = "+391234567890",
    email = null,
    preferred_channel = "whatsapp",
  } = overrides;

  return {
    id,
    tenant_id: TENANT_ID,
    patient_id,
    scheduled_at,
    duration_min,
    status,
    patient: { id: patient_id, first_name, last_name, phone, email, preferred_channel },
  };
}

/** Build a waitlist_offers row for a declined offer. */
function makeDeclinedOffer(patientId: string, respondedAt: string) {
  return {
    id: `offer-${patientId}`,
    tenant_id: TENANT_ID,
    patient_id: patientId,
    status: "declined",
    responded_at: respondedAt,
  };
}

describe("findCandidates", () => {
  // ---------------------------------------------------------------------------
  // 1. Returns candidates from appointments table, not waitlist_entries
  // ---------------------------------------------------------------------------
  it("returns candidates from appointments table, not waitlist_entries", async () => {
    const candidateAppt = makeAppt({
      id: "appt-candidate",
      patient_id: "pat-001",
      // 30 days after open slot — qualifies
      scheduled_at: new Date(OPEN_SLOT_AT.getTime() + 30 * 86_400_000).toISOString(),
    });

    const supabase = createMockSupabase({
      appointments: [candidateAppt],
      waitlist_entries: [], // empty — candidates must come from appointments
      waitlist_offers: [],
    });

    const results = await findCandidates(supabase, BASE_SLOT);

    expect(results).toHaveLength(1);
    expect(results[0].candidateAppointmentId).toBe("appt-candidate");
    expect(results[0].patientId).toBe("pat-001");
  });

  // ---------------------------------------------------------------------------
  // 2. Excludes the cancelling patient from candidates
  // ---------------------------------------------------------------------------
  it("excludes the cancelling patient from candidates", async () => {
    const cancellerAppt = makeAppt({
      id: "appt-canceller-future",
      patient_id: CANCELLING_PATIENT_ID,
      scheduled_at: new Date(OPEN_SLOT_AT.getTime() + 14 * 86_400_000).toISOString(),
    });

    const supabase = createMockSupabase({
      appointments: [cancellerAppt],
      waitlist_offers: [],
    });

    const results = await findCandidates(supabase, BASE_SLOT);

    expect(results).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 3. Excludes patients in 24hr decline cooldown
  // ---------------------------------------------------------------------------
  it("excludes patients in 24hr decline cooldown", async () => {
    const recentlyDeclined = "pat-declined";
    const candidateAppt = makeAppt({
      id: "appt-declined-patient",
      patient_id: recentlyDeclined,
      scheduled_at: new Date(OPEN_SLOT_AT.getTime() + 20 * 86_400_000).toISOString(),
    });

    // Declined 1 hour ago — within 24hr window
    const declinedOffer = makeDeclinedOffer(
      recentlyDeclined,
      new Date(Date.now() - 1 * 3_600_000).toISOString(),
    );

    const supabase = createMockSupabase({
      appointments: [candidateAppt],
      waitlist_offers: [declinedOffer],
    });

    const results = await findCandidates(supabase, BASE_SLOT);

    const patientIds = results.map((r) => r.patientId);
    expect(patientIds).not.toContain(recentlyDeclined);
  });

  // ---------------------------------------------------------------------------
  // 4. Excludes time-conflicting appointments (range overlap)
  // ---------------------------------------------------------------------------
  it("excludes time-conflicting appointments", async () => {
    // Open slot: OPEN_SLOT_AT to OPEN_SLOT_AT+60min.
    // Candidate appointment starts 30min into the open slot — overlaps.
    const conflictAppt = makeAppt({
      id: "appt-conflict",
      patient_id: "pat-conflict",
      scheduled_at: new Date(OPEN_SLOT_AT.getTime() + 30 * 60_000).toISOString(),
      duration_min: 60,
    });

    const supabase = createMockSupabase({
      appointments: [conflictAppt],
      waitlist_offers: [],
    });

    const results = await findCandidates(supabase, BASE_SLOT);

    expect(results).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 5. Only includes appointments AFTER the open slot
  // ---------------------------------------------------------------------------
  it("only includes appointments AFTER the open slot", async () => {
    // Appointment 1 day before open slot — excluded
    const beforeAppt = makeAppt({
      id: "appt-before",
      patient_id: "pat-before",
      scheduled_at: new Date(OPEN_SLOT_AT.getTime() - 24 * 3_600_000).toISOString(),
    });

    // Appointment 1 day + 2 hours after open slot — included (after slot ends too)
    const afterAppt = makeAppt({
      id: "appt-after",
      patient_id: "pat-after",
      scheduled_at: new Date(OPEN_SLOT_AT.getTime() + 26 * 3_600_000).toISOString(),
    });

    const supabase = createMockSupabase({
      appointments: [beforeAppt, afterAppt],
      waitlist_offers: [],
    });

    const results = await findCandidates(supabase, BASE_SLOT);

    expect(results).toHaveLength(1);
    expect(results[0].patientId).toBe("pat-after");
  });

  // ---------------------------------------------------------------------------
  // 6. Deduplicates by patient, keeping farthest-out appointment
  // ---------------------------------------------------------------------------
  it("deduplicates by patient, keeping farthest-out appointment", async () => {
    const patientId = "pat-multi";
    // 10 days out + 1 hr (no conflict), closer appointment
    const closerAppt = makeAppt({
      id: "appt-closer",
      patient_id: patientId,
      scheduled_at: new Date(OPEN_SLOT_AT.getTime() + 10 * 86_400_000 + 60 * 60_000).toISOString(),
    });
    // 60 days out, farther appointment
    const fartherAppt = makeAppt({
      id: "appt-farther",
      patient_id: patientId,
      scheduled_at: new Date(OPEN_SLOT_AT.getTime() + 60 * 86_400_000).toISOString(),
    });

    const supabase = createMockSupabase({
      appointments: [closerAppt, fartherAppt],
      waitlist_offers: [],
    });

    const results = await findCandidates(supabase, BASE_SLOT);

    // Patient should appear only once, with the farther appointment
    expect(results).toHaveLength(1);
    expect(results[0].candidateAppointmentId).toBe("appt-farther");
  });

  // ---------------------------------------------------------------------------
  // 7. Returns empty array when slot is in the past
  // ---------------------------------------------------------------------------
  it("returns empty array when slot is in the past", async () => {
    const pastSlot: OpenSlotDetails = {
      ...BASE_SLOT,
      scheduledAt: new Date("2026-03-01T10:00:00Z"), // in the past
    };

    const supabase = createMockSupabase({ appointments: [], waitlist_offers: [] });

    const results = await findCandidates(supabase, pastSlot);

    expect(results).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 8. Returns empty array when no candidates found (after all filters)
  // ---------------------------------------------------------------------------
  it("returns empty array when no candidates found", async () => {
    const supabase = createMockSupabase({
      appointments: [],
      waitlist_offers: [],
    });

    const results = await findCandidates(supabase, BASE_SLOT);

    expect(results).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 9. Caps results at the limit parameter
  // ---------------------------------------------------------------------------
  it("caps results at the limit parameter", async () => {
    // Create 5 distinct patients each with a future appointment (well after open slot)
    const appts = Array.from({ length: 5 }, (_, i) =>
      makeAppt({
        id: `appt-${i}`,
        patient_id: `pat-${i}`,
        // Each appointment is at a different day, all well after the open slot
        scheduled_at: new Date(OPEN_SLOT_AT.getTime() + (i + 1) * 14 * 86_400_000).toISOString(),
      }),
    );

    const supabase = createMockSupabase({
      appointments: appts,
      waitlist_offers: [],
    });

    const results = await findCandidates(supabase, BASE_SLOT, 3);

    expect(results).toHaveLength(3);
  });

  // ---------------------------------------------------------------------------
  // 10. Ranks by candidate score descending
  // ---------------------------------------------------------------------------
  it("ranks by candidate score descending", async () => {
    // patA: appointment 65 days out → appointmentDistance=60, total=80 (60+20 neutral)
    const patA = makeAppt({
      id: "appt-a",
      patient_id: "pat-a",
      scheduled_at: new Date(OPEN_SLOT_AT.getTime() + 65 * 86_400_000).toISOString(),
      first_name: "Alice",
      last_name: "A",
    });

    // patB: appointment 8 days + 2hr out → appointmentDistance=20, total=40 (20+20 neutral)
    const patB = makeAppt({
      id: "appt-b",
      patient_id: "pat-b",
      scheduled_at: new Date(OPEN_SLOT_AT.getTime() + 8 * 86_400_000 + 2 * 3_600_000).toISOString(),
      first_name: "Bob",
      last_name: "B",
    });

    const supabase = createMockSupabase({
      appointments: [patB, patA], // intentionally out of order
      waitlist_offers: [],
    });

    const results = await findCandidates(supabase, BASE_SLOT);

    expect(results.length).toBeGreaterThanOrEqual(2);
    // Alice (farther out) should rank first
    expect(results[0].patientId).toBe("pat-a");
    expect(results[0].candidateScore.total).toBeGreaterThan(results[1].candidateScore.total);
  });
});
