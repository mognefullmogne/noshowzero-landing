import { z } from "zod";

// --- Patient ---

export const CreatePatientSchema = z.object({
  first_name: z.string().min(1).max(255),
  last_name: z.string().min(1).max(255),
  external_id: z.string().max(255).optional(),
  date_of_birth: z.string().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),
  preferred_channel: z.enum(["whatsapp", "sms", "email"]).default("email"),
});

// --- Appointment ---

export const CreateAppointmentSchema = z.object({
  patient_id: z.string().uuid(),
  service_name: z.string().min(1).max(255),
  service_code: z.string().max(100).optional(),
  provider_name: z.string().max(255).optional(),
  location_name: z.string().max(255).optional(),
  scheduled_at: z.string().datetime(),
  duration_min: z.number().int().min(5).max(480).default(30),
  payment_category: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  external_id: z.string().max(255).optional(),
});

export const UpdateAppointmentSchema = z.object({
  status: z.enum([
    "scheduled",
    "reminder_pending",
    "reminder_sent",
    "confirmed",
    "declined",
    "timeout",
    "completed",
    "no_show",
    "cancelled",
  ]),
});

// --- Waitlist ---

const TimeSlotSchema = z.object({
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat"]),
  from: z.string().regex(/^\d{2}:\d{2}$/),
  to: z.string().regex(/^\d{2}:\d{2}$/),
});

export const CreateWaitlistEntrySchema = z.object({
  patient_id: z.string().uuid(),
  service_name: z.string().min(1).max(255),
  service_code: z.string().max(100).optional(),
  preferred_provider: z.string().max(255).optional(),
  location_name: z.string().max(255).optional(),
  preferred_time_slots: z.array(TimeSlotSchema).default([]),
  flexible_time: z.boolean().default(true),
  clinical_urgency: z.enum(["none", "low", "medium", "high", "critical"]).default("none"),
  distance_km: z.number().min(0).optional(),
  payment_category: z.string().max(50).optional(),
  valid_until: z.string().datetime().optional(),
  max_offers: z.number().int().min(1).max(10).default(3),
});

export const UpdateWaitlistEntrySchema = z.object({
  status: z
    .enum([
      "waiting",
      "offer_pending",
      "offer_accepted",
      "offer_declined",
      "offer_timeout",
      "fulfilled",
      "expired",
      "withdrawn",
    ])
    .optional(),
  clinical_urgency: z.enum(["none", "low", "medium", "high", "critical"]).optional(),
  preferred_time_slots: z.array(TimeSlotSchema).optional(),
  flexible_time: z.boolean().optional(),
});

// --- Public API (v1) ---

export const PublicCreateAppointmentSchema = z.object({
  external_id: z.string().min(1).max(255),
  patient: z.object({
    external_id: z.string().min(1).max(255),
    first_name: z.string().min(1).max(255),
    last_name: z.string().min(1).max(255),
    phone: z.string().max(50).optional(),
    email: z.string().email().max(255).optional(),
  }),
  service_name: z.string().min(1).max(255),
  service_code: z.string().max(100).optional(),
  provider_name: z.string().max(255).optional(),
  location_name: z.string().max(255).optional(),
  scheduled_at: z.string().datetime(),
  duration_min: z.number().int().min(5).max(480).default(30),
  payment_category: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

export const PublicUpsertPatientSchema = z.object({
  external_id: z.string().min(1).max(255),
  first_name: z.string().min(1).max(255),
  last_name: z.string().min(1).max(255),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),
  preferred_channel: z.enum(["whatsapp", "sms", "email"]).default("email"),
});

// --- Query filters ---

export const AppointmentFiltersSchema = z.object({
  status: z
    .enum([
      "scheduled",
      "reminder_pending",
      "reminder_sent",
      "confirmed",
      "declined",
      "timeout",
      "completed",
      "no_show",
      "cancelled",
    ])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  patient_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const WaitlistFiltersSchema = z.object({
  status: z
    .enum([
      "waiting",
      "offer_pending",
      "offer_accepted",
      "offer_declined",
      "offer_timeout",
      "fulfilled",
      "expired",
      "withdrawn",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const AnalyticsFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
