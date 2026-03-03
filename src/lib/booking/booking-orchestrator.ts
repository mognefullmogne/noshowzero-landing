/**
 * Main orchestrator for the conversational booking flow.
 * Handles incoming messages during an active booking session,
 * dispatches to the correct state handler, and returns reply text.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingSession, BookingSessionState } from "./types";
import { TERMINAL_STATES } from "./types";
import {
  findActiveSession,
  createSession,
  advanceSession,
  terminateSession,
} from "./session-manager";
import { parseItalianDate } from "./date-parser";
import { findAvailableSlots } from "./slot-finder";
import { createAppointmentFromBooking } from "./appointment-creator";
import * as msg from "./messages";

const MAX_ATTEMPTS = 3;

/** Patterns that indicate the user wants to cancel the booking. */
const CANCEL_PATTERN = /\b(annulla|cancella\s+prenotazione|esci|stop)\b/i;

/** Name validation: at least two words, letters/spaces/accents only. */
const NAME_PATTERN = /^([A-Za-zÀ-ÿ'-]+)\s+([A-Za-zÀ-ÿ'-]+.*)$/;

interface BookingInput {
  readonly tenantId: string;
  readonly patientId: string | null;
  readonly patientName: string | null;
  readonly phone: string;
  readonly channel: "whatsapp" | "sms";
  readonly messageBody: string;
}

interface BookingResult {
  readonly reply: string;
  readonly action: string;
}

/**
 * Handle an incoming message in the booking flow.
 * Called from the Twilio webhook when a booking intent is detected
 * or when an active booking session exists.
 */
export async function handleBookingMessage(
  supabase: SupabaseClient,
  input: BookingInput
): Promise<BookingResult> {
  try {
    // 1. Check for active session (scoped to tenant)
    const session = await findActiveSession(supabase, input.phone, input.tenantId);

    if (session) {
      // Check expiry
      if (new Date(session.expires_at) <= new Date()) {
        await terminateSession(supabase, session.id, "expired");
        return startNewSession(supabase, input);
      }

      // Check cancellation
      if (CANCEL_PATTERN.test(input.messageBody)) {
        await terminateSession(supabase, session.id, "abandoned");
        return { reply: msg.CANCELLED, action: "booking_cancelled" };
      }

      // Dispatch to state handler
      return dispatchState(supabase, session, input);
    }

    // 2. No active session — start a new one
    return startNewSession(supabase, input);
  } catch (err) {
    console.error("[BookingOrchestrator] handleBookingMessage error:", err);
    return { reply: msg.GENERIC_ERROR, action: "booking_error" };
  }
}

async function startNewSession(
  supabase: SupabaseClient,
  input: BookingInput
): Promise<BookingResult> {
  const isKnown = input.patientId !== null;
  const initialState: BookingSessionState = isKnown
    ? "awaiting_service"
    : "awaiting_name";

  const session = await createSession(supabase, {
    tenantId: input.tenantId,
    phone: input.phone,
    channel: input.channel,
    patientId: input.patientId ?? undefined,
    initialState,
  });

  if (!session) {
    return { reply: msg.GENERIC_ERROR, action: "booking_session_create_failed" };
  }

  if (isKnown) {
    const name = input.patientName ?? "paziente";
    return { reply: msg.greetKnown(name), action: "booking_started_known" };
  }

  return { reply: msg.GREET_UNKNOWN, action: "booking_started_unknown" };
}

async function dispatchState(
  supabase: SupabaseClient,
  session: BookingSession,
  input: BookingInput
): Promise<BookingResult> {
  switch (session.state) {
    case "awaiting_name":
      return handleAwaitingName(supabase, session, input);
    case "awaiting_service":
      return handleAwaitingService(supabase, session, input);
    case "awaiting_date":
      return handleAwaitingDate(supabase, session, input);
    case "awaiting_slot_selection":
      return handleAwaitingSlotSelection(supabase, session, input);
    default:
      return { reply: msg.GENERIC_ERROR, action: "booking_invalid_state" };
  }
}

// --- State Handlers ---

async function handleAwaitingName(
  supabase: SupabaseClient,
  session: BookingSession,
  input: BookingInput
): Promise<BookingResult> {
  const match = input.messageBody.trim().match(NAME_PATTERN);

  if (!match) {
    return handleRetry(supabase, session, msg.INVALID_NAME);
  }

  const firstName = match[1].trim();
  const lastName = match[2].trim();

  // Check for existing patient with same phone in this tenant (avoid duplicates)
  const { data: existingPatient } = await supabase
    .from("patients")
    .select("id")
    .eq("tenant_id", session.tenant_id)
    .eq("phone", session.phone)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  let patientId: string;

  if (existingPatient) {
    patientId = existingPatient.id;
  } else {
    // Create the patient
    const { data: newPatient, error: patientError } = await supabase
      .from("patients")
      .insert({
        tenant_id: session.tenant_id,
        first_name: firstName,
        last_name: lastName,
        phone: session.phone,
        preferred_channel: session.channel,
        is_active: true,
      })
      .select("id")
      .single();

    if (patientError || !newPatient) {
      console.error("[BookingOrchestrator] Patient creation error:", { code: patientError?.code, message: patientError?.message });
      return { reply: msg.GENERIC_ERROR, action: "booking_patient_create_failed" };
    }
    patientId = newPatient.id;
  }

  await advanceSession(supabase, session.id, {
    state: "awaiting_service",
    patient_id: patientId,
    collected_name: `${firstName} ${lastName}`,
    attempts: 0,
  });

  return {
    reply: msg.askService(firstName),
    action: "booking_name_collected",
  };
}

async function handleAwaitingService(
  supabase: SupabaseClient,
  session: BookingSession,
  input: BookingInput
): Promise<BookingResult> {
  // Sanitize: strip control chars, trim, cap length
  const service = input.messageBody
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .trim()
    .slice(0, 200);

  if (service.length < 2) {
    return handleRetry(supabase, session, msg.INVALID_SERVICE);
  }

  await advanceSession(supabase, session.id, {
    state: "awaiting_date",
    collected_service: service,
    attempts: 0,
  });

  return {
    reply: msg.ASK_DATE,
    action: "booking_service_collected",
  };
}

async function handleAwaitingDate(
  supabase: SupabaseClient,
  session: BookingSession,
  input: BookingInput
): Promise<BookingResult> {
  const parsed = await parseItalianDate(input.messageBody);

  if (!parsed) {
    return handleRetry(supabase, session, msg.INVALID_DATE);
  }

  // Find available slots
  const slots = await findAvailableSlots(
    supabase,
    session.tenant_id,
    parsed.date,
    session.collected_service ?? undefined
  );

  if (slots.length === 0) {
    // Don't count as a retry — just re-ask for another date
    await advanceSession(supabase, session.id, {
      state: "awaiting_date",
      collected_date_raw: input.messageBody,
      attempts: session.attempts,
    });

    return { reply: msg.NO_SLOTS, action: "booking_no_slots" };
  }

  await advanceSession(supabase, session.id, {
    state: "awaiting_slot_selection",
    collected_date_raw: input.messageBody,
    collected_date: parsed.date,
    proposed_slots: slots,
    attempts: 0,
  });

  return {
    reply: msg.slotsFound(slots),
    action: "booking_slots_proposed",
  };
}

async function handleAwaitingSlotSelection(
  supabase: SupabaseClient,
  session: BookingSession,
  input: BookingInput
): Promise<BookingResult> {
  const slots = session.proposed_slots;
  if (!slots || slots.length === 0) {
    return { reply: msg.GENERIC_ERROR, action: "booking_no_proposed_slots" };
  }

  // Parse selection number — allow digit anywhere in a short message
  const selectionMatch = input.messageBody.trim().match(/\b([1-9])\b/);
  if (!selectionMatch) {
    return handleRetry(supabase, session, msg.INVALID_SLOT);
  }

  const selectedIndex = parseInt(selectionMatch[1], 10);
  const selectedSlot = slots.find((s) => s.index === selectedIndex);

  if (!selectedSlot) {
    return handleRetry(supabase, session, msg.INVALID_SLOT);
  }

  const patientId = session.patient_id;
  if (!patientId) {
    return { reply: msg.GENERIC_ERROR, action: "booking_no_patient" };
  }

  // Create the appointment
  const result = await createAppointmentFromBooking(
    supabase,
    session.tenant_id,
    patientId,
    {
      slotId: selectedSlot.slotId,
      startAt: selectedSlot.startAt,
      endAt: selectedSlot.endAt,
      providerName: selectedSlot.providerName,
    },
    session.collected_service ?? "Visita"
  );

  if (!result.success) {
    if (result.error === "slot_unavailable") {
      return { reply: msg.SLOT_TAKEN, action: "booking_slot_taken" };
    }
    return { reply: msg.GENERIC_ERROR, action: "booking_create_failed" };
  }

  // Terminate session as completed
  await advanceSession(supabase, session.id, {
    state: "completed",
    selected_slot_index: selectedIndex,
    selected_slot_id: selectedSlot.slotId,
    created_appointment_id: result.appointmentId,
    attempts: session.attempts,
  });

  // Format confirmation message
  const date = new Date(selectedSlot.startAt);
  const dateStr = date.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    reply: msg.confirmed(
      session.collected_service ?? "Visita",
      dateStr,
      timeStr,
      selectedSlot.providerName
    ),
    action: "booking_completed",
  };
}

// --- Retry Helper ---

async function handleRetry(
  supabase: SupabaseClient,
  session: BookingSession,
  retryMessage: string
): Promise<BookingResult> {
  const newAttempts = session.attempts + 1;

  if (newAttempts >= MAX_ATTEMPTS) {
    await terminateSession(supabase, session.id, "abandoned");
    return { reply: msg.MAX_ATTEMPTS, action: "booking_max_attempts" };
  }

  await advanceSession(supabase, session.id, {
    state: session.state,
    attempts: newAttempts,
  });

  return { reply: retryMessage, action: "booking_retry" };
}
