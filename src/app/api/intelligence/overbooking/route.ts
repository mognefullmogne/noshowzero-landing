// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/intelligence/overbooking?date=YYYY-MM-DD
 *
 * Returns overbooking recommendations for the given date based on
 * historical no-show patterns. Informational only — staff decides.
 *
 * Protected by session auth (requires logged-in user with tenant).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { getOverbookingRecommendations } from "@/lib/intelligence/overbooking";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;
  const { tenantId } = auth.data;

  const supabase = await createClient();

  // Validate date parameter
  const dateParam = request.nextUrl.searchParams.get("date");
  if (!dateParam || !DATE_PATTERN.test(dateParam)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_DATE",
          message: "Parametro 'date' richiesto nel formato YYYY-MM-DD",
        },
      },
      { status: 400 }
    );
  }

  // Validate date is parseable
  const parsedDate = new Date(`${dateParam}T12:00:00Z`);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_DATE", message: "Data non valida" },
      },
      { status: 400 }
    );
  }

  try {
    const recommendations = await getOverbookingRecommendations(supabase, tenantId, dateParam);

    return NextResponse.json({
      success: true,
      data: {
        date: dateParam,
        recommendations,
        totalRecommendations: recommendations.length,
      },
    });
  } catch (err) {
    console.error("[API] overbooking error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "Errore interno" } },
      { status: 500 }
    );
  }
}
