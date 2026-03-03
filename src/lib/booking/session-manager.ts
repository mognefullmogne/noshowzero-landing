/**
 * Booking session persistence layer.
 * Manages multi-turn booking conversation state in the database.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingSession,
  BookingSessionState,
  BookingSessionRow,
} from "./types";
import { TERMINAL_STATES } from "./types";

/** Active (non-terminal) states for querying. */
const ACTIVE_STATES: readonly BookingSessionState[] = [
  "awaiting_name",
  "awaiting_service",
  "awaiting_date",
  "awaiting_slot_selection",
];

/**
 * Find an active (non-terminal, non-expired) booking session for a phone number.
 * When tenantId is provided, scopes the lookup to that tenant.
 */
export async function findActiveSession(
  supabase: SupabaseClient,
  phone: string,
  tenantId?: string
): Promise<BookingSession | null> {
  let query = supabase
    .from("booking_sessions")
    .select("*")
    .eq("phone", phone)
    .in("state", [...ACTIVE_STATES])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[BookingSession] findActiveSession error:", error);
    return null;
  }

  return data as BookingSession | null;
}

/**
 * Create a new booking session with a 30-minute expiry.
 */
export async function createSession(
  supabase: SupabaseClient,
  params: {
    readonly tenantId: string;
    readonly phone: string;
    readonly channel: "whatsapp" | "sms";
    readonly patientId?: string;
    readonly initialState: BookingSessionState;
  }
): Promise<BookingSession | null> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("booking_sessions")
    .insert({
      tenant_id: params.tenantId,
      patient_id: params.patientId ?? null,
      phone: params.phone,
      channel: params.channel,
      state: params.initialState,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[BookingSession] createSession error:", error);
    return null;
  }

  return data as BookingSession;
}

/**
 * Advance a session: update state + fields, refresh expiry.
 */
export async function advanceSession(
  supabase: SupabaseClient,
  sessionId: string,
  updates: Partial<BookingSessionRow> & { readonly state: BookingSessionState }
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("booking_sessions")
    .update({
      ...updates,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error("[BookingSession] advanceSession error:", error);
    return false;
  }

  return true;
}

/**
 * Terminate a session by setting it to a final state.
 */
export async function terminateSession(
  supabase: SupabaseClient,
  sessionId: string,
  finalState: "completed" | "expired" | "abandoned"
): Promise<boolean> {
  const { error } = await supabase
    .from("booking_sessions")
    .update({
      state: finalState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error("[BookingSession] terminateSession error:", error);
    return false;
  }

  return true;
}
