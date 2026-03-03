/**
 * GET /api/integrations/outlook/callback
 * Handle Outlook OAuth callback: exchange code, encrypt tokens, store integration.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleOutlookCallback } from "@/lib/integrations/outlook-calendar";
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
    const redirectUri = `${appUrl}/api/integrations/outlook/callback`;
    const tokens = await handleOutlookCallback(code, redirectUri);

    await supabase.from("calendar_integrations").upsert(
      {
        tenant_id: tenantId,
        provider: "outlook",
        label: "Outlook Calendar",
        access_token_enc: encryptToken(tokens.accessToken),
        refresh_token_enc: encryptToken(tokens.refreshToken),
        token_expires_at: tokens.expiresAt,
        status: "active",
        error_message: null,
      },
      { onConflict: "tenant_id,provider" }
    );

    return NextResponse.redirect(
      `${appUrl}/integrations?connected=outlook`
    );
  } catch (err) {
    console.error("[OutlookOAuth] Callback error:", err);
    return NextResponse.redirect(
      `${appUrl}/integrations?error=oauth_failed`
    );
  }
}
