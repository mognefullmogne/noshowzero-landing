/**
 * Token refresh helpers for Google and Outlook integrations.
 * Decrypts stored tokens, refreshes if expired, re-encrypts and updates DB.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarIntegration } from "./types";
import { decryptToken, encryptToken } from "./encryption";
import { refreshGoogleToken } from "./google-calendar";
import { refreshOutlookToken } from "./outlook-calendar";

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 min before expiry

/**
 * Ensure the Google access token is valid. Refreshes if expired.
 * Returns the decrypted access token.
 */
export async function ensureValidGoogleToken(
  supabase: SupabaseClient,
  integration: CalendarIntegration
): Promise<string> {
  return ensureValidToken(supabase, integration, "google");
}

/**
 * Ensure the Outlook access token is valid. Refreshes if expired.
 * Returns the decrypted access token.
 */
export async function ensureValidOutlookToken(
  supabase: SupabaseClient,
  integration: CalendarIntegration
): Promise<string> {
  return ensureValidToken(supabase, integration, "outlook");
}

async function ensureValidToken(
  supabase: SupabaseClient,
  integration: CalendarIntegration,
  provider: "google" | "outlook"
): Promise<string> {
  if (!integration.access_token_enc || !integration.refresh_token_enc) {
    throw new Error(`No tokens stored for ${provider} integration`);
  }

  const accessToken = decryptToken(integration.access_token_enc);
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0;

  // Token still valid
  if (Date.now() + REFRESH_BUFFER_MS < expiresAt) {
    return accessToken;
  }

  // Token expired or about to expire — refresh
  const refreshToken = decryptToken(integration.refresh_token_enc);

  const refreshed =
    provider === "google"
      ? await refreshGoogleToken(refreshToken)
      : await refreshOutlookToken(refreshToken);

  // Update DB with new encrypted token
  await supabase
    .from("calendar_integrations")
    .update({
      access_token_enc: encryptToken(refreshed.accessToken),
      token_expires_at: refreshed.expiresAt,
    })
    .eq("id", integration.id);

  return refreshed.accessToken;
}
