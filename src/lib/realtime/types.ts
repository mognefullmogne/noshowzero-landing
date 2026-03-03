import type { Appointment } from "@/lib/types";

/**
 * Shape of a Supabase Realtime postgres_changes payload.
 * Supabase delivers raw row data (no JOINs) with eventType discriminator.
 */
export interface RealtimeAppointmentEvent {
  readonly eventType: "INSERT" | "UPDATE" | "DELETE";
  readonly new: Record<string, unknown>;
  readonly old: Record<string, unknown>;
}

/**
 * Realtime channel subscription status values.
 * Maps to the status callback parameter from supabase.channel().subscribe().
 */
export type RealtimeStatus =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CLOSED"
  | "CHANNEL_ERROR"
  | "CONNECTING";

/**
 * Return type for the useRealtimeAppointments hook.
 */
export interface UseRealtimeAppointmentsReturn {
  readonly appointments: readonly Appointment[];
  readonly loading: boolean;
  readonly realtimeStatus: RealtimeStatus;
}

/** Channel statuses that indicate a terminal failure requiring channel-level reconnection. */
export const RECONNECTABLE_STATUSES: readonly RealtimeStatus[] = [
  "CLOSED",
  "TIMED_OUT",
  "CHANNEL_ERROR",
] as const;

/** Maximum number of channel-level reconnection attempts before giving up. */
export const MAX_RECONNECT_ATTEMPTS = 5;
