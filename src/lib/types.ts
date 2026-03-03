// Core product types — ported from NestJS shared package

export type AppointmentStatus =
  | "scheduled"
  | "reminder_pending"
  | "reminder_sent"
  | "confirmed"
  | "declined"
  | "timeout"
  | "completed"
  | "no_show"
  | "cancelled";

export type WaitlistStatus =
  | "waiting"
  | "offer_pending"
  | "offer_accepted"
  | "offer_declined"
  | "offer_timeout"
  | "fulfilled"
  | "expired"
  | "withdrawn";

export type ClinicalUrgency = "none" | "low" | "medium" | "high" | "critical";

export type MessageChannel = "whatsapp" | "sms" | "email";

// --- Database row types ---

export interface Patient {
  readonly id: string;
  readonly tenant_id: string;
  readonly external_id: string | null;
  readonly first_name: string;
  readonly last_name: string;
  readonly date_of_birth: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly preferred_channel: MessageChannel;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface Appointment {
  readonly id: string;
  readonly tenant_id: string;
  readonly patient_id: string;
  readonly service_code: string | null;
  readonly service_name: string;
  readonly provider_name: string | null;
  readonly location_name: string | null;
  readonly scheduled_at: string;
  readonly duration_min: number;
  readonly status: AppointmentStatus;
  readonly external_id: string | null;
  readonly payment_category: string | null;
  readonly notes: string | null;
  readonly risk_score: number | null;
  readonly risk_reasoning: string | null;
  readonly risk_scored_at: string | null;
  readonly confirmation_sent_at: string | null;
  readonly confirmation_deadline: string | null;
  readonly confirmed_at: string | null;
  readonly declined_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  // Joined
  readonly patient?: Patient;
}

export interface Reminder {
  readonly id: string;
  readonly tenant_id: string;
  readonly appointment_id: string;
  readonly channel: MessageChannel;
  readonly message_tone: string;
  readonly scheduled_at: string;
  readonly sent_at: string | null;
  readonly status: string;
  readonly created_at: string;
}

export interface WaitlistEntry {
  readonly id: string;
  readonly tenant_id: string;
  readonly patient_id: string;
  readonly service_code: string | null;
  readonly service_name: string;
  readonly preferred_provider: string | null;
  readonly location_name: string | null;
  readonly preferred_time_slots: TimeSlot[];
  readonly flexible_time: boolean;
  readonly clinical_urgency: ClinicalUrgency;
  readonly distance_km: number | null;
  readonly payment_category: string | null;
  readonly status: WaitlistStatus;
  readonly priority_score: number;
  readonly priority_reason: string | null;
  readonly smart_score: number | null;
  readonly smart_score_breakdown: SmartScoreBreakdown | null;
  readonly valid_until: string | null;
  readonly max_offers: number;
  readonly offers_sent: number;
  readonly created_at: string;
  readonly updated_at: string;
  // Joined
  readonly patient?: Patient;
}

export interface TimeSlot {
  readonly day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
  readonly from: string; // HH:MM
  readonly to: string; // HH:MM
}

export interface SmartScoreBreakdown {
  readonly total: number;
  readonly urgency: number;
  readonly reliability: number;
  readonly timePreference: number;
  readonly waitingTime: number;
  readonly distance: number;
  readonly providerMatch: number;
  readonly paymentMatch: number;
}

export interface ContactScheduleEntry {
  readonly hoursBefore: number;
  readonly channel: MessageChannel;
  readonly messageTone: "standard" | "urgent" | "friendly";
}

// --- API response types ---

export interface ApiResponse<T> {
  readonly success: true;
  readonly data: T;
}

export interface ApiError {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface AnalyticsData {
  readonly totalAppointments: number;
  readonly noShowRate: number;
  readonly noShowCount: number;
  readonly completedCount: number;
  readonly cancelledCount: number;
  readonly confirmedCount: number;
  readonly scheduledCount: number;
  readonly waitlistFills: number;
  readonly avgRiskScore: number;
  readonly revenueSaved: number;
}

// Appointment status transition map
export const VALID_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  scheduled: ["confirmed", "cancelled", "reminder_pending"],
  reminder_pending: ["reminder_sent", "cancelled"],
  reminder_sent: ["confirmed", "declined", "timeout", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  declined: ["cancelled"],
  timeout: ["cancelled"],
  completed: [],
  no_show: [],
  cancelled: [],
} as const;
