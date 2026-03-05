// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/integrations/outlook/auth
 * Generate Outlook OAuth consent URL and redirect.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { getOutlookAuthUrl } from "@/lib/integrations/outlook-calendar";
import { createOAuthState } from "@/lib/integrations/oauth-state";

export async function GET() {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { tenantId } = auth.data;
  const state = createOAuthState(tenantId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/integrations/outlook/callback`;

  const authUrl = getOutlookAuthUrl(redirectUri, state);
  return NextResponse.redirect(authUrl);
}
