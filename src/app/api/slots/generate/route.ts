/**
 * POST /api/slots/generate — Auto-generate weekly slots.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { GenerateSlotsSchema } from "@/lib/validations";
import { generateWeeklySlots } from "@/lib/optimization/slot-management";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const parsed = GenerateSlotsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const result = await generateWeeklySlots(supabase, {
    tenantId: auth.data.tenantId,
    providerName: parsed.data.provider_name,
    locationName: parsed.data.location_name,
    serviceCode: parsed.data.service_code,
    startDate: parsed.data.start_date,
    endDate: parsed.data.end_date,
    slotDurationMin: parsed.data.slot_duration_min,
    dayStartHour: parsed.data.day_start_hour,
    dayEndHour: parsed.data.day_end_hour,
    excludeWeekends: parsed.data.exclude_weekends,
  });

  if (result.error) {
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_ERROR", message: result.error } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: { created: result.created } }, { status: 201 });
}
