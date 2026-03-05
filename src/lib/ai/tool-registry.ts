// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * AI tool definitions + dispatch for operator chat.
 * Each tool is a function that takes validated params and returns structured results.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { searchAppointments } from "./tools/search-appointments";
import { getAppointmentDetails } from "./tools/get-appointment-details";
import { rescheduleAppointment } from "./tools/reschedule-appointment";
import { cancelAppointment } from "./tools/cancel-appointment";
import { findAvailableSlots } from "./tools/find-available-slots";
import { sendMessageToPatient } from "./tools/send-message-to-patient";
import { getPatientInfo } from "./tools/get-patient-info";
import { checkWaitlist } from "./tools/check-waitlist";
import { addToWaitlist } from "./tools/add-to-waitlist";
import { getCalendarOverview } from "./tools/get-calendar-overview";

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: "search_appointments",
    description: "Search appointments by patient name, date range, or status. Returns a list of matching appointments.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Patient name or search term" },
        status: { type: "string", description: "Filter by status (scheduled, confirmed, cancelled, etc.)" },
        from_date: { type: "string", description: "Start date (ISO 8601)" },
        to_date: { type: "string", description: "End date (ISO 8601)" },
      },
    },
  },
  {
    name: "get_appointment_details",
    description: "Get full details of a specific appointment including patient info and reminders.",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "string", description: "UUID of the appointment" },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "reschedule_appointment",
    description: "Reschedule an appointment by cancelling the current one and creating a new one at a different time.",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "string", description: "UUID of the appointment to reschedule" },
        new_scheduled_at: { type: "string", description: "New date/time (ISO 8601)" },
      },
      required: ["appointment_id", "new_scheduled_at"],
    },
  },
  {
    name: "cancel_appointment",
    description: "Cancel an appointment and trigger backfill from waitlist.",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "string", description: "UUID of the appointment to cancel" },
        reason: { type: "string", description: "Cancellation reason" },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "find_available_slots",
    description: "Find available appointment slots for a given date range and optionally a specific provider.",
    input_schema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "Start date (ISO 8601)" },
        to_date: { type: "string", description: "End date (ISO 8601)" },
        provider_name: { type: "string", description: "Filter by provider name" },
      },
      required: ["from_date", "to_date"],
    },
  },
  {
    name: "send_message_to_patient",
    description: "Send a WhatsApp/SMS message to a patient.",
    input_schema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "UUID of the patient" },
        message: { type: "string", description: "Message body to send" },
      },
      required: ["patient_id", "message"],
    },
  },
  {
    name: "get_patient_info",
    description: "Get patient details and appointment history.",
    input_schema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "UUID of the patient" },
        patient_name: { type: "string", description: "Search by patient name instead of ID" },
      },
    },
  },
  {
    name: "check_waitlist",
    description: "Check waitlist entries, optionally filtered by service or patient.",
    input_schema: {
      type: "object",
      properties: {
        service_name: { type: "string", description: "Filter by service name" },
        patient_id: { type: "string", description: "Filter by patient UUID" },
        status: { type: "string", description: "Filter by status (waiting, offer_pending, etc.)" },
      },
    },
  },
  {
    name: "add_to_waitlist",
    description: "Add a patient to the waitlist for a specific service.",
    input_schema: {
      type: "object",
      properties: {
        patient_id: { type: "string", description: "UUID of the patient" },
        service_name: { type: "string", description: "Service name" },
        preferred_provider: { type: "string", description: "Preferred provider name" },
        clinical_urgency: { type: "string", description: "Urgency level (none, low, medium, high, critical)" },
      },
      required: ["patient_id", "service_name"],
    },
  },
  {
    name: "get_calendar_overview",
    description: "Get a weekly calendar overview showing appointments, gaps, and utilization per provider.",
    input_schema: {
      type: "object",
      properties: {
        week_start: { type: "string", description: "Start of week (ISO 8601 date, e.g. 2026-03-02)" },
        provider_name: { type: "string", description: "Filter by provider name" },
      },
      required: ["week_start"],
    },
  },
];

export async function dispatchTool(
  supabase: SupabaseClient,
  tenantId: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "search_appointments":
      return searchAppointments(supabase, tenantId, input);
    case "get_appointment_details":
      return getAppointmentDetails(supabase, tenantId, input.appointment_id as string);
    case "reschedule_appointment":
      return rescheduleAppointment(supabase, tenantId, input);
    case "cancel_appointment":
      return cancelAppointment(supabase, tenantId, input);
    case "find_available_slots":
      return findAvailableSlots(supabase, tenantId, input);
    case "send_message_to_patient":
      return sendMessageToPatient(supabase, tenantId, input);
    case "get_patient_info":
      return getPatientInfo(supabase, tenantId, input);
    case "check_waitlist":
      return checkWaitlist(supabase, tenantId, input);
    case "add_to_waitlist":
      return addToWaitlist(supabase, tenantId, input);
    case "get_calendar_overview":
      return getCalendarOverview(supabase, tenantId, input);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
