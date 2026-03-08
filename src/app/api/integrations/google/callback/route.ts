// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/integrations/google/callback
 * Handle Google OAuth callback: exchange code, encrypt tokens, store integration.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleGoogleCallback } from "@/lib/integrations/google-calendar";
import { encryptToken } from "@/lib/integrations/encryption";
import { verifyOAuthState } from "@/lib/integrations/oauth-state";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/integrations?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/integrations?error=missing_params`
    );
  }

  // Verify HMAC state
  const stateResult = verifyOAuthState(state);
  if (!stateResult.valid) {
    return NextResponse.redirect(
      `${appUrl}/integrations?error=invalid_state`
    );
  }

  const tenantId = stateResult.tenantId;

  // Re-verify session user owns this tenant (prevent state token replay)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/integrations?error=not_authenticated`);
  }
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.redirect(`${appUrl}/integrations?error=tenant_mismatch`);
  }

  try {
    const redirectUri = `${appUrl}/api/integrations/google/callback`;
    const tokens = await handleGoogleCallback(code, redirectUri);

    if (!tokens.accessToken) {
      console.error("[GoogleOAuth] Token exchange returned no access_token");
      return NextResponse.redirect(`${appUrl}/integrations?error=oauth_failed`);
    }

    // Upsert integration with encrypted tokens
    const row: Record<string, unknown> = {
      tenant_id: tenantId,
      provider: "google",
      label: "Google Calendar",
      access_token_enc: encryptToken(tokens.accessToken),
      token_expires_at: tokens.expiresAt,
      status: "active",
      error_message: null,
    };

    // refreshToken is only returned on first consent — don't overwrite with null on re-auth
    if (tokens.refreshToken) {
      row.refresh_token_enc = encryptToken(tokens.refreshToken);
    }

    const { error: upsertError } = await supabase
      .from("calendar_integrations")
      .upsert(row, { onConflict: "tenant_id,provider" });

    if (upsertError) {
      console.error("[GoogleOAuth] DB upsert failed:", {
        code: upsertError.code,
        message: upsertError.message,
        details: upsertError.details,
        hint: upsertError.hint,
        tenantId,
      });
      return NextResponse.redirect(`${appUrl}/integrations?error=save_failed`);
    }

    // Redirect to integrations page with success
    return NextResponse.redirect(
      `${appUrl}/integrations?connected=google`
    );
  } catch (err) {
    console.error("[GoogleOAuth] Callback error:", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      tenantId,
      hasCode: !!code,
    });
    return NextResponse.redirect(
      `${appUrl}/integrations?error=oauth_failed`
    );
  }
}
