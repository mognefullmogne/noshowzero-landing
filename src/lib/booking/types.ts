// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Types for the conversational appointment booking flow.
 */

export type BookingSessionState =
  | "awaiting_name"
  | "awaiting_service"
  | "awaiting_date"
  | "awaiting_slot_selection"
  | "completed"
  | "expired"
  | "abandoned";

export const TERMINAL_STATES: ReadonlySet<BookingSessionState> = new Set([
  "completed",
  "expired",
  "abandoned",
]);

export interface BookingSession {
  readonly id: string;
  readonly tenant_id: string;
  readonly patient_id: string | null;
  readonly phone: string;
  readonly channel: "whatsapp" | "sms";
  readonly state: BookingSessionState;
  readonly collected_name: string | null;
  readonly collected_service: string | null;
  readonly collected_date_raw: string | null;
  readonly collected_date: string | null;
  readonly proposed_slots: readonly ProposedSlotOption[] | null;
  readonly selected_slot_index: number | null;
  readonly selected_slot_id: string | null;
  readonly created_appointment_id: string | null;
  readonly attempts: number;
  readonly expires_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ProposedSlotOption {
  readonly index: number;
  readonly slotId: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly providerName: string;
}

export interface BookingStepResult {
  readonly reply: string;
  readonly nextState: BookingSessionState;
  readonly updates: Partial<BookingSessionRow>;
}

/** Database row shape for INSERT/UPDATE (snake_case, mutable fields only). */
export interface BookingSessionRow {
  readonly patient_id: string | null;
  readonly state: BookingSessionState;
  readonly collected_name: string | null;
  readonly collected_service: string | null;
  readonly collected_date_raw: string | null;
  readonly collected_date: string | null;
  readonly proposed_slots: readonly ProposedSlotOption[] | null;
  readonly selected_slot_index: number | null;
  readonly selected_slot_id: string | null;
  readonly created_appointment_id: string | null;
  readonly attempts: number;
}
