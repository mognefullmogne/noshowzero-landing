import type { Appointment } from "@/lib/types";
import type { RealtimeAppointmentEvent } from "./types";

/**
 * Immutable delta-merge for Supabase Realtime postgres_changes events.
 *
 * Applies INSERT/UPDATE/DELETE events to an existing appointments array,
 * always returning a new array reference (never mutating the input).
 *
 * Key behavior:
 * - INSERT: Prepends new appointment. Deduplicates by id (idempotent).
 * - UPDATE: Merges changed fields but PRESERVES the `patient` join field
 *   (Realtime events contain raw row data without JOINed relations).
 * - DELETE: Filters out by id.
 * - Default: Returns current array unchanged.
 *
 * This function is pure -- no side effects, no external dependencies beyond types.
 */
export function applyDelta(
  current: readonly Appointment[],
  payload: RealtimeAppointmentEvent,
): readonly Appointment[] {
  switch (payload.eventType) {
    case "INSERT": {
      const newRow = payload.new as unknown as Appointment;
      // Idempotent: skip if already present
      if (current.some((a) => a.id === newRow.id)) {
        return current;
      }
      return [newRow, ...current];
    }

    case "UPDATE": {
      const updated = payload.new as unknown as Appointment;
      const index = current.findIndex((a) => a.id === updated.id);

      if (index === -1) {
        // Appointment not in current view -- append it
        // (may be entering the user's filter scope)
        return [...current, updated];
      }

      // Merge updated fields but preserve the existing `patient` join data,
      // since Realtime events do NOT include JOINed relations (Pitfall 1).
      const existing = current[index];
      return current.map((a) =>
        a.id === updated.id
          ? { ...a, ...updated, patient: existing.patient }
          : a,
      );
    }

    case "DELETE": {
      const deleted = payload.old as { readonly id: string };
      return current.filter((a) => a.id !== deleted.id);
    }

    default:
      return current;
  }
}
