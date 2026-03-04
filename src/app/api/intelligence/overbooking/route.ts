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
import { getOverbookingRecommendations } from "@/lib/intelligence/overbooking";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Non autenticato" } },
      { status: 401 }
    );
  }

  // Get tenant_id from user metadata
  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: { code: "NO_TENANT", message: "Tenant non trovato" } },
      { status: 403 }
    );
  }

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
