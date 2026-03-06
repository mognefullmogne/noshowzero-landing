// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Smart Rebooking Flow
 *
 * When a patient cancels:
 * 1. Find available slots from calendar gaps (next 7 business days)
 * 2. Create a slot_proposals entry in DB so patient can respond 1/2/3
 * 3. Send WhatsApp message with options + waitlist option
 * 4. If no slots, offer waitlist only
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CancelledAppointment {
  readonly id: string;
  readonly service_name: string;
  readonly provider_name: string | null;
  readonly location_name: string | null;
  readonly scheduled_at: string;
  readonly duration_min: number;
}

interface GapSlot {
  readonly startAt: string;
  readonly endAt: string;
  readonly dayLabel: string;
  readonly timeLabel: string;
}

// ---------------------------------------------------------------------------
// Calendar gap finder
// ---------------------------------------------------------------------------

/** Business hours in tenant local time: 9:00 - 18:00 */
const BIZ_START_HOUR = 9;
const BIZ_END_HOUR = 18;
const MAX_DAYS_AHEAD = 7;
const MAX_SLOTS = 3;

/** Tenant timezone — all slot times are displayed and compared in this zone. */
const TENANT_TIMEZONE = "Europe/Rome";

/**
 * Convert "YYYY-MM-DD" + hour in a local timezone to UTC milliseconds.
 * Strategy: create a UTC timestamp for that hour, check what local hour it
 * corresponds to, then shift to find the UTC time where local hour matches.
 */
function localToUtcMs(dayStr: string, hour: number, tz: string): number {
  const utcMs = Date.UTC(
    parseInt(dayStr.slice(0, 4)),
    parseInt(dayStr.slice(5, 7)) - 1,
    parseInt(dayStr.slice(8, 10)),
    hour, 0, 0
  );
  const d = new Date(utcMs);
  const localHour =
    parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(d)
    ) % 24;
  // Shift so that the resulting UTC time corresponds to `hour` in local timezone
  return utcMs + (hour - localHour) * 3_600_000;
}

/**
 * Find gaps in the tenant's calendar for the next 7 business days.
 * All times are computed in TENANT_TIMEZONE so business hours and day labels
 * match what patients see in the app.
 */
async function findCalendarGaps(
  supabase: SupabaseClient,
  tenantId: string,
  durationMin: number
): Promise<readonly GapSlot[]> {
  const now = new Date();
  const gaps: GapSlot[] = [];

  for (let dayOffset = 1; dayOffset <= MAX_DAYS_AHEAD && gaps.length < MAX_SLOTS; dayOffset++) {
    const candidateMs = now.getTime() + dayOffset * 24 * 60 * 60 * 1000;
    const candidate = new Date(candidateMs);

    // Get local date string (YYYY-MM-DD) and day-of-week in tenant timezone
    const localDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: TENANT_TIMEZONE }).format(candidate);
    const localDow = new Date(candidate.toLocaleString("en-US", { timeZone: TENANT_TIMEZONE })).getDay();

    // Skip weekends (0=Sun, 6=Sat)
    if (localDow === 0 || localDow === 6) continue;

    // Business hours boundaries in UTC (so DB comparisons are correct)
    const bizStartMs = localToUtcMs(localDateStr, BIZ_START_HOUR, TENANT_TIMEZONE);
    const bizEndMs = localToUtcMs(localDateStr, BIZ_END_HOUR, TENANT_TIMEZONE);
    const dayStart = new Date(bizStartMs).toISOString();
    const dayEnd = new Date(bizEndMs).toISOString();

    // Fetch existing appointments for this day
    const { data: appts } = await supabase
      .from("appointments")
      .select("scheduled_at, duration_min")
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", dayStart)
      .lt("scheduled_at", dayEnd)
      .not("status", "in", "(cancelled,declined,no_show)")
      .order("scheduled_at", { ascending: true });

    // Build occupied intervals
    const occupied = (appts ?? []).map((a) => {
      const start = new Date(a.scheduled_at).getTime();
      const end = start + (a.duration_min ?? 30) * 60_000;
      return { start, end };
    });

    // Find gaps between occupied intervals during business hours
    let cursor = bizStartMs;

    for (const interval of occupied) {
      if (interval.start > cursor) {
        const gapDuration = (interval.start - cursor) / 60_000;
        if (gapDuration >= durationMin) {
          gaps.push(buildGapSlot(new Date(cursor), durationMin));
          if (gaps.length >= MAX_SLOTS) break;
        }
      }
      cursor = Math.max(cursor, interval.end);
    }

    // Check gap after last appointment until end of business hours
    if (gaps.length < MAX_SLOTS && cursor < bizEndMs) {
      const gapDuration = (bizEndMs - cursor) / 60_000;
      if (gapDuration >= durationMin) {
        gaps.push(buildGapSlot(new Date(cursor), durationMin));
      }
    }
  }

  return gaps;
}

function buildGapSlot(startDate: Date, durationMin: number): GapSlot {
  const endDate = new Date(startDate.getTime() + durationMin * 60_000);
  return {
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
    dayLabel: startDate.toLocaleDateString("it-IT", {
      timeZone: TENANT_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    timeLabel: startDate.toLocaleTimeString("it-IT", {
      timeZone: TENANT_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

// ---------------------------------------------------------------------------
// Slot proposal creation + message send
// ---------------------------------------------------------------------------

/**
 * Create a slot_proposals entry and build the message text.
 * Does NOT send the message — the caller includes it in the TwiML reply.
 * Returns the message body text for the patient.
 */
async function createProposalAndBuildMessage(
  supabase: SupabaseClient,
  tenantId: string,
  appointmentId: string,
  patientId: string,
  firstName: string,
  serviceName: string,
  slots: readonly GapSlot[]
): Promise<string> {
  if (slots.length === 0) {
    // No slots available — offer waitlist only
    return [
      `Ciao ${firstName}!`,
      `Al momento non ci sono slot disponibili per ${serviceName} nei prossimi giorni.`,
      "",
      `Rispondi LISTA per essere inserito in lista d'attesa: ti contatteremo appena si libera un posto.`,
    ].join("\n");
  }

  // Build proposed_slots in the format expected by slot_proposals table
  const proposedSlots = slots.map((s, i) => ({
    index: i + 1,
    slot_id: `gap_${s.startAt}`, // synthetic ID for calendar gap slots
    start_at: s.startAt,
    end_at: s.endAt,
  }));

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

  const { error } = await supabase
    .from("slot_proposals")
    .insert({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      patient_id: patientId,
      proposed_slots: proposedSlots,
      status: "pending",
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[SmartRebook] Failed to create slot proposal:", error);
    return [
      `Ciao ${firstName}!`,
      `Si è verificato un errore nel cercare nuovi orari per ${serviceName}.`,
      `Contatta la segreteria per riprogrammare.`,
    ].join("\n");
  }

  // Build message text
  const lines = [
    `Ciao ${firstName}! Ecco alcune opzioni per riprogrammare il tuo appuntamento per ${serviceName}:`,
    "",
  ];

  for (const slot of slots) {
    const idx = slots.indexOf(slot) + 1;
    lines.push(`*${idx}* - ${slot.dayLabel} alle ${slot.timeLabel}`);
  }

  lines.push(
    "",
    "Rispondi con 1, 2 o 3 per scegliere.",
    "",
    "Se nessun orario va bene, rispondi LISTA per essere messo in lista d'attesa e ti contatteremo appena si libera un posto."
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute the full rebooking flow when a patient cancels:
 * 1. Find available calendar gaps
 * 2. Create slot_proposals entry
 * 3. Send WhatsApp with options + waitlist fallback
 */
export async function generateRebookingSuggestions(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  cancelledAppointment: CancelledAppointment
): Promise<{ message: string; suggestedSlots: readonly GapSlot[] }> {
  // Load patient info
  const { data: patient } = await supabase
    .from("patients")
    .select("first_name, phone")
    .eq("id", patientId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const firstName = patient?.first_name ?? "Paziente";
  const phone = patient?.phone ?? null;

  if (!phone) {
    console.error("[SmartRebook] No phone for patient:", patientId.slice(0, 8));
    return { message: "", suggestedSlots: [] };
  }

  // Find calendar gaps
  const gaps = await findCalendarGaps(
    supabase,
    tenantId,
    cancelledAppointment.duration_min
  );

  // Create proposal + build message (does NOT send — caller includes in TwiML reply)
  const messageBody = await createProposalAndBuildMessage(
    supabase,
    tenantId,
    cancelledAppointment.id,
    patientId,
    firstName,
    cancelledAppointment.service_name,
    gaps
  );

  return { message: messageBody, suggestedSlots: gaps };
}
