// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Google Calendar integration via Google Calendar API v3.
 * Uses fetch() directly — no SDK dependency.
 *
 * OAuth scopes: calendar.readonly
 */

import type {
  NormalizedCalendarEvent,
  OAuthTokens,
  CalendarInfo,
} from "./types";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

/**
 * Generate Google OAuth2 consent URL.
 * State parameter includes tenantId for CSRF prevention.
 */
export function getGoogleAuthUrl(
  redirectUri: string,
  state: string
): string {
  const { clientId } = getGoogleCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access + refresh tokens.
 */
export async function handleGoogleCallback(
  code: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const { clientId, clientSecret } = getGoogleCredentials();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google token exchange failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  const expiresAt = new Date(
    Date.now() + (data.expires_in ?? 3600) * 1000
  ).toISOString();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

/**
 * Refresh an expired access token.
 */
export async function refreshGoogleToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: string }> {
  const { clientId, clientSecret } = getGoogleCredentials();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(
      Date.now() + (data.expires_in ?? 3600) * 1000
    ).toISOString(),
  };
}

/**
 * List the user's calendars.
 */
export async function listGoogleCalendars(
  accessToken: string
): Promise<CalendarInfo[]> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/users/me/calendarList`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to list Google calendars: ${response.status}`);
  }

  const data = await response.json();
  return (data.items ?? []).map(
    (cal: { id: string; summary: string; primary?: boolean }) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary ?? false,
    })
  );
}

/**
 * Fetch events from a Google Calendar. Supports incremental sync via syncToken.
 */
export async function fetchGoogleEvents(
  accessToken: string,
  calendarId: string,
  syncToken?: string,
  _isFallback = false
): Promise<{
  events: NormalizedCalendarEvent[];
  nextSyncToken: string | null;
}> {
  const events: NormalizedCalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const params = new URLSearchParams({
      maxResults: "250",
      singleEvents: "true",
      orderBy: "startTime",
    });

    if (syncToken) {
      params.set("syncToken", syncToken);
    } else {
      // Full sync: only future events
      params.set("timeMin", new Date().toISOString());
    }

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 410) {
      // Sync token invalidated — do full sync (one retry only)
      if (_isFallback) {
        throw new Error("Google Calendar sync token invalidated during full sync");
      }
      return fetchGoogleEvents(accessToken, calendarId, undefined, true);
    }

    if (!response.ok) {
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const data = await response.json();

    for (const item of data.items ?? []) {
      if (!item.start?.dateTime && !item.start?.date) continue;

      const startAt = item.start.dateTime ?? `${item.start.date}T00:00:00`;
      const endAt = item.end?.dateTime ?? item.end?.date
        ? (item.end.dateTime ?? `${item.end.date}T23:59:59`)
        : new Date(new Date(startAt).getTime() + 30 * 60_000).toISOString();

      const attendees: { name?: string; email?: string }[] = (
        item.attendees ?? []
      ).map((a: { displayName?: string; email?: string }) => ({
        ...(a.displayName ? { name: a.displayName } : {}),
        ...(a.email ? { email: a.email } : {}),
      }));

      events.push({
        externalId: `google_${item.id}`,
        summary: item.summary ?? "Evento",
        description: item.description ?? null,
        location: item.location ?? null,
        startAt,
        endAt,
        attendees,
        organizerEmail: item.organizer?.email ?? null,
        status: mapGoogleStatus(item.status),
        recurrenceRule: null, // singleEvents=true expands recurrence
      });
    }

    pageToken = data.nextPageToken;
    nextSyncToken = data.nextSyncToken ?? null;
  } while (pageToken);

  return { events, nextSyncToken };
}

function mapGoogleStatus(
  status: string
): "confirmed" | "tentative" | "cancelled" {
  switch (status) {
    case "cancelled":
      return "cancelled";
    case "tentative":
      return "tentative";
    default:
      return "confirmed";
  }
}
