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

/** Schema for creating appointment with inline patient data (dashboard form). */
export const InlineCreateAppointmentSchema = z.object({
  // Patient info (created or matched automatically)
  patient: z.object({
    first_name: z.string().min(1, "First name is required").max(255),
    last_name: z.string().min(1, "Last name is required").max(255),
    phone: z.string().max(50).optional(),
    email: z.string().email("Invalid email").max(255).optional(),
    preferred_channel: z.enum(["whatsapp", "sms", "email"]).default("whatsapp"),
  }).refine(
    (p) => (p.phone && p.phone.length > 0) || (p.email && p.email.length > 0),
    { message: "At least one contact method (phone or email) is required" }
  ),
  // Appointment info
  service_name: z.string().min(1, "Service is required").max(255),
  provider_name: z.string().min(1, "Provider is required").max(255),
  location_name: z.string().min(1, "Location is required").max(255),
  scheduled_at: z.string().min(1, "Date & time is required").refine(
    (v) => !isNaN(new Date(v).getTime()),
    { message: "Invalid date/time" }
  ),
  duration_min: z.number().int().min(5).max(480).default(30),
  notes: z.string().max(2000).optional(),
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
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
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

export const OffersFiltersSchema = z.object({
  status: z
    .enum(["pending", "accepted", "declined", "expired", "cancelled"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const AnalyticsFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// --- Messaging ---

export const SendMessageSchema = z.object({
  body: z.string().min(1).max(4096),
  channel: z.enum(["whatsapp", "sms", "email"]).optional(),
});

// --- Slots ---

export const CreateSlotSchema = z.object({
  provider_name: z.string().min(1).max(255),
  location_name: z.string().max(255).optional(),
  service_code: z.string().max(100).optional(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  status: z.enum(["available", "booked", "blocked", "cancelled"]).default("available"),
  block_reason: z.string().max(500).optional(),
});

export const UpdateSlotSchema = z.object({
  status: z.enum(["available", "booked", "blocked", "cancelled"]).optional(),
  block_reason: z.string().max(500).optional(),
});

export const GenerateSlotsSchema = z.object({
  provider_name: z.string().min(1).max(255),
  location_name: z.string().max(255).optional(),
  service_code: z.string().max(100).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot_duration_min: z.number().int().min(5).max(480).default(30),
  day_start_hour: z.number().int().min(0).max(23).default(8),
  day_end_hour: z.number().int().min(1).max(24).default(18),
  exclude_weekends: z.boolean().default(true),
});

export const SlotFiltersSchema = z.object({
  provider_name: z.string().optional(),
  status: z.enum(["available", "booked", "blocked", "cancelled"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

// --- Optimization ---

export const ApproveDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

// --- Rules ---

export const CreateRulesetSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  entity_type: z.enum(["appointment", "waitlist", "offer", "reminder", "optimization"]),
  is_active: z.boolean().default(true),
});

export const UpdateRulesetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  is_active: z.boolean().optional(),
});

const RuleConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "contains"]),
  value: z.unknown(),
});

const RuleActionSchema = z.object({
  type: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const CreateRuleVersionSchema = z.object({
  conditions: z.array(RuleConditionSchema).min(1),
  actions: z.array(RuleActionSchema).min(1),
  notes: z.string().max(2000).optional(),
});

// --- AI Chat ---

export const AiChatSchema = z.object({
  message: z.string().min(1).max(4096),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
  context: z
    .object({
      appointment_id: z.string().uuid().optional(),
      patient_id: z.string().uuid().optional(),
    })
    .optional(),
});

// --- Audit ---

export const AuditFiltersSchema = z.object({
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  action: z.string().optional(),
  actor_type: z.enum(["user", "system", "ai", "cron", "webhook"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// --- KPI ---

export const KpiFiltersSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(365).default(30),
});
