// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

// Calendar integration types — unified model for all providers

export type IntegrationProvider = "google" | "outlook" | "ical" | "csv";
export type IntegrationStatus = "active" | "paused" | "revoked" | "error";
export type ImportLogStatus = "running" | "completed" | "failed";

export interface CalendarIntegration {
  readonly id: string;
  readonly tenant_id: string;
  readonly provider: IntegrationProvider;
  readonly label: string | null;
  readonly access_token_enc: string | null;
  readonly refresh_token_enc: string | null;
  readonly token_expires_at: string | null;
  readonly ical_url: string | null;
  readonly calendar_ids: string[];
  readonly last_sync_at: string | null;
  readonly sync_token: string | null;
  readonly status: IntegrationStatus;
  readonly error_message: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ImportLog {
  readonly id: string;
  readonly tenant_id: string;
  readonly integration_id: string | null;
  readonly provider: IntegrationProvider;
  readonly status: ImportLogStatus;
  readonly total_events: number;
  readonly imported: number;
  readonly skipped: number;
  readonly failed: number;
  readonly error_details: readonly ImportError[];
  readonly started_at: string;
  readonly completed_at: string | null;
}

export interface ImportError {
  readonly eventSummary: string;
  readonly reason: string;
}

export interface NormalizedCalendarEvent {
  readonly externalId: string;
  readonly summary: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly startAt: string; // ISO 8601
  readonly endAt: string;   // ISO 8601
  readonly attendees: readonly CalendarAttendee[];
  readonly organizerEmail: string | null;
  readonly status: "confirmed" | "tentative" | "cancelled";
  readonly recurrenceRule: string | null;
}

export interface CalendarAttendee {
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
}

export interface ImportResult {
  readonly total: number;
  readonly imported: number;
  readonly skipped: number;
  readonly failed: number;
  readonly errors: readonly ImportError[];
}

export interface OAuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string; // ISO 8601
}

export interface CalendarInfo {
  readonly id: string;
  readonly summary: string;
  readonly primary: boolean;
}
