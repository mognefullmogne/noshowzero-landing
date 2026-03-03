/**
 * Outlook Calendar integration via Microsoft Graph API.
 * Uses fetch() directly — no SDK dependency.
 *
 * OAuth scopes: Calendars.Read
 */

import type {
  NormalizedCalendarEvent,
  OAuthTokens,
  CalendarInfo,
} from "./types";

const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_API = "https://graph.microsoft.com/v1.0";
const SCOPES = "Calendars.Read offline_access";

function getMicrosoftCredentials() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

/**
 * Generate Microsoft OAuth2 consent URL.
 */
export function getOutlookAuthUrl(
  redirectUri: string,
  state: string
): string {
  const { clientId } = getMicrosoftCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
    prompt: "consent",
  });
  return `${MS_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function handleOutlookCallback(
  code: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const { clientId, clientSecret } = getMicrosoftCredentials();

  const response = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Outlook token exchange failed: ${response.status} ${errorBody}`);
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
export async function refreshOutlookToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: string }> {
  const { clientId, clientSecret } = getMicrosoftCredentials();

  const response = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    throw new Error(`Outlook token refresh failed: ${response.status}`);
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
 * List the user's Outlook calendars.
 */
export async function listOutlookCalendars(
  accessToken: string
): Promise<CalendarInfo[]> {
  const response = await fetch(`${GRAPH_API}/me/calendars`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to list Outlook calendars: ${response.status}`);
  }

  const data = await response.json();
  return (data.value ?? []).map(
    (cal: { id: string; name: string; isDefaultCalendar?: boolean }) => ({
      id: cal.id,
      summary: cal.name,
      primary: cal.isDefaultCalendar ?? false,
    })
  );
}

/**
 * Fetch events from an Outlook calendar. Supports delta sync via deltaLink.
 */
export async function fetchOutlookEvents(
  accessToken: string,
  calendarId: string,
  deltaLink?: string
): Promise<{
  events: NormalizedCalendarEvent[];
  nextDeltaLink: string | null;
}> {
  const events: NormalizedCalendarEvent[] = [];
  let nextLink: string | undefined;
  let nextDeltaLink: string | null = null;

  // Initial URL
  let url: string;
  if (deltaLink) {
    url = deltaLink;
  } else {
    const now = new Date().toISOString();
    url = `${GRAPH_API}/me/calendars/${calendarId}/calendarView/delta?startDateTime=${now}&endDateTime=${new Date(Date.now() + 6 * 30 * 86_400_000).toISOString()}&$top=100`;
  }

  do {
    const response = await fetch(nextLink ?? url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Outlook Calendar API error: ${response.status}`);
    }

    const data = await response.json();

    for (const item of data.value ?? []) {
      if (!item.start?.dateTime) continue;

      const startAt = item.start.dateTime.endsWith("Z")
        ? item.start.dateTime
        : `${item.start.dateTime}Z`;
      const endAt = item.end?.dateTime
        ? item.end.dateTime.endsWith("Z")
          ? item.end.dateTime
          : `${item.end.dateTime}Z`
        : new Date(new Date(startAt).getTime() + 30 * 60_000).toISOString();

      const attendees: { name?: string; email?: string }[] = (
        item.attendees ?? []
      ).map(
        (a: {
          emailAddress?: { name?: string; address?: string };
        }) => ({
          ...(a.emailAddress?.name ? { name: a.emailAddress.name } : {}),
          ...(a.emailAddress?.address
            ? { email: a.emailAddress.address }
            : {}),
        })
      );

      events.push({
        externalId: `outlook_${item.id}`,
        summary: item.subject ?? "Evento",
        description: item.bodyPreview ?? null,
        location: item.location?.displayName ?? null,
        startAt,
        endAt,
        attendees,
        organizerEmail: item.organizer?.emailAddress?.address ?? null,
        status: mapOutlookStatus(item.showAs, item.isCancelled),
        recurrenceRule: null,
      });
    }

    nextLink = data["@odata.nextLink"];
    if (data["@odata.deltaLink"]) {
      nextDeltaLink = data["@odata.deltaLink"];
    }
  } while (nextLink);

  return { events, nextDeltaLink };
}

function mapOutlookStatus(
  showAs?: string,
  isCancelled?: boolean
): "confirmed" | "tentative" | "cancelled" {
  if (isCancelled) return "cancelled";
  if (showAs === "tentative") return "tentative";
  return "confirmed";
}
