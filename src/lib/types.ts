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

// --- Waitlist Offer types ---

export type OfferStatus = "pending" | "accepted" | "declined" | "expired" | "cancelled";

export interface WaitlistOffer {
  readonly id: string;
  readonly tenant_id: string;
  readonly original_appointment_id: string;
  readonly waitlist_entry_id: string;
  readonly patient_id: string;
  readonly new_appointment_id: string | null;
  readonly status: OfferStatus;
  readonly smart_score: number | null;
  readonly smart_score_breakdown: SmartScoreBreakdown | null;
  readonly token_hash: string;
  readonly offered_at: string;
  readonly expires_at: string;
  readonly responded_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  // Joined
  readonly patient?: Patient;
  readonly waitlist_entry?: WaitlistEntry;
  readonly original_appointment?: Appointment;
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
  // Offer metrics
  readonly offersSent: number;
  readonly offersAccepted: number;
  readonly offersDeclined: number;
  readonly offersExpired: number;
  readonly offersPending: number;
  readonly offerFillRate: number;
  readonly avgResponseMinutes: number | null;
}

// --- New enums for ported features ---

export type MessageDirection = "inbound" | "outbound";
export type IntentSource = "regex" | "ai" | "manual";
export type DeliveryStatusEnum = "queued" | "sent" | "delivered" | "read" | "failed" | "undelivered";
export type SlotStatus = "available" | "booked" | "blocked" | "cancelled";
export type OptimizationType = "gap_fill" | "proactive_reschedule" | "slot_swap" | "load_balance";
export type DecisionStatus = "proposed" | "approved" | "rejected" | "executed" | "expired";
export type ActorType = "user" | "system" | "ai" | "cron" | "webhook";
export type ConfirmationState = "pending_send" | "message_sent" | "confirmed" | "declined" | "timed_out" | "cancelled";

export type MessageIntent =
  | "confirm"
  | "cancel"
  | "accept_offer"
  | "decline_offer"
  | "slot_select"
  | "question"
  | "unknown";

// --- Message thread & events ---

export interface MessageThread {
  readonly id: string;
  readonly tenant_id: string;
  readonly patient_id: string;
  readonly channel: MessageChannel;
  readonly external_thread_id: string | null;
  readonly last_message_at: string | null;
  readonly is_resolved: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  // Joined
  readonly patient?: Patient;
  readonly latest_message?: MessageEvent;
}

export interface MessageEvent {
  readonly id: string;
  readonly tenant_id: string;
  readonly thread_id: string;
  readonly direction: MessageDirection;
  readonly channel: MessageChannel;
  readonly body: string;
  readonly from_number: string | null;
  readonly to_number: string | null;
  readonly external_sid: string | null;
  readonly intent: MessageIntent | null;
  readonly intent_confidence: number | null;
  readonly intent_source: IntentSource | null;
  readonly context_appointment_id: string | null;
  readonly context_offer_id: string | null;
  readonly created_at: string;
}

export interface DeliveryStatus {
  readonly id: string;
  readonly message_event_id: string;
  readonly status: DeliveryStatusEnum;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly raw_payload: unknown;
  readonly created_at: string;
}

// --- Appointment slots ---

export interface AppointmentSlot {
  readonly id: string;
  readonly tenant_id: string;
  readonly provider_name: string;
  readonly location_name: string | null;
  readonly service_code: string | null;
  readonly start_at: string;
  readonly end_at: string;
  readonly status: SlotStatus;
  readonly appointment_id: string | null;
  readonly block_reason: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

// --- Optimization ---

export interface OptimizationDecision {
  readonly id: string;
  readonly tenant_id: string;
  readonly type: OptimizationType;
  readonly status: DecisionStatus;
  readonly description: string;
  readonly reasoning: string | null;
  readonly score: number;
  readonly source_appointment_id: string | null;
  readonly target_slot_id: string | null;
  readonly target_waitlist_entry_id: string | null;
  readonly proposed_changes: Record<string, unknown>;
  readonly approved_by: string | null;
  readonly approved_at: string | null;
  readonly executed_at: string | null;
  readonly expires_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

// --- Rules engine ---

export interface Ruleset {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly entity_type: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  // Joined
  readonly active_version?: RuleVersion;
  readonly versions?: readonly RuleVersion[];
}

export interface RuleVersion {
  readonly id: string;
  readonly ruleset_id: string;
  readonly tenant_id: string;
  readonly version: number;
  readonly conditions: readonly RuleCondition[];
  readonly actions: readonly RuleAction[];
  readonly is_active: boolean;
  readonly created_by: string | null;
  readonly notes: string | null;
  readonly created_at: string;
}

export interface RuleCondition {
  readonly field: string;
  readonly operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "contains";
  readonly value: unknown;
}

export interface RuleAction {
  readonly type: string;
  readonly params: Record<string, unknown>;
}

// --- Audit ---

export interface AuditEvent {
  readonly id: string;
  readonly tenant_id: string;
  readonly actor_type: ActorType;
  readonly actor_id: string | null;
  readonly entity_type: string;
  readonly entity_id: string | null;
  readonly action: string;
  readonly metadata: Record<string, unknown>;
  readonly ip_address: string | null;
  readonly created_at: string;
}

// --- Workflows ---

export interface ConfirmationWorkflow {
  readonly id: string;
  readonly tenant_id: string;
  readonly appointment_id: string;
  readonly state: ConfirmationState;
  readonly message_event_id: string | null;
  readonly deadline_at: string;
  readonly attempts: number;
  readonly last_error: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  // Joined
  readonly appointment?: Appointment;
}

export interface SlotProposal {
  readonly id: string;
  readonly tenant_id: string;
  readonly appointment_id: string;
  readonly patient_id: string;
  readonly thread_id: string | null;
  readonly proposed_slots: readonly ProposedSlotOption[];
  readonly selected_index: number | null;
  readonly selected_slot_id: string | null;
  readonly status: "pending" | "selected" | "expired" | "cancelled";
  readonly expires_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ProposedSlotOption {
  readonly index: number;
  readonly slot_id: string;
  readonly start_at: string;
  readonly end_at: string;
  readonly provider_name: string;
}

export interface KpiSnapshot {
  readonly id: string;
  readonly tenant_id: string;
  readonly snapshot_date: string;
  readonly period: "daily" | "weekly" | "monthly";
  readonly metrics: KpiMetrics;
  readonly created_at: string;
}

export interface KpiMetrics {
  readonly total_appointments: number;
  readonly no_shows: number;
  readonly cancellations: number;
  readonly completions: number;
  readonly confirmation_rate: number;
  readonly avg_risk_score: number;
  readonly offers_sent: number;
  readonly offers_accepted: number;
  readonly backfill_rate: number;
  readonly avg_response_minutes: number | null;
  readonly revenue_saved: number;
  readonly optimization_actions: number;
}

export interface FailedJob {
  readonly id: string;
  readonly tenant_id: string | null;
  readonly job_type: string;
  readonly job_payload: Record<string, unknown>;
  readonly error_message: string;
  readonly error_stack: string | null;
  readonly retry_count: number;
  readonly max_retries: number;
  readonly next_retry_at: string | null;
  readonly resolved_at: string | null;
  readonly created_at: string;
}

// --- AI Chat types ---

export interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly tool_calls?: readonly ChatToolCall[];
}

export interface ChatToolCall {
  readonly tool_name: string;
  readonly input: Record<string, unknown>;
  readonly result: unknown;
}

export interface ChatResult {
  readonly response: string;
  readonly tool_calls: readonly ChatToolCall[];
  readonly tokens_used: number;
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
