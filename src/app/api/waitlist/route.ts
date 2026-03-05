import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { CreateWaitlistEntrySchema, WaitlistFiltersSchema } from "@/lib/validations";
import { calculateInitialPriority, computeWaitlistScore } from "@/lib/scoring/waitlist-score";
import { autoScoreWaitlistEntries } from "@/lib/scoring/auto-score";

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const filters = WaitlistFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!filters.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: filters.error.message } },
        { status: 400 }
      );
    }

    const { status, page, pageSize } = filters.data;
    const supabase = await createClient();

    let query = supabase
      .from("waitlist_entries")
      .select("*, patient:patients(*)", { count: "exact" })
      .eq("tenant_id", auth.data.tenantId)
      .order("priority_score", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) {
      console.error("Waitlist fetch error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to fetch waitlist" } },
        { status: 500 }
      );
    }

    // Fire-and-forget: score any unscored entries
    autoScoreWaitlistEntries(supabase, auth.data.tenantId);

    const total = count ?? 0;
    return NextResponse.json({
      success: true,
      data: data ?? [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error("Waitlist GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = CreateWaitlistEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify patient exists
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("id", parsed.data.patient_id)
      .eq("tenant_id", auth.data.tenantId)
      .maybeSingle();

    if (!patient) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Patient not found" } },
        { status: 404 }
      );
    }

    // Calculate initial priority
    const priority = calculateInitialPriority({
      flexibleTime: parsed.data.flexible_time,
      clinicalUrgency: parsed.data.clinical_urgency,
    });

    // Get patient history for smart score
    const { count: totalAppts } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", parsed.data.patient_id)
      .eq("tenant_id", auth.data.tenantId);

    const { count: noShows } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", parsed.data.patient_id)
      .eq("tenant_id", auth.data.tenantId)
      .eq("status", "no_show");

    const smartScore = computeWaitlistScore({
      clinicalUrgency: parsed.data.clinical_urgency,
      patientNoShows: noShows ?? 0,
      patientTotal: totalAppts ?? 0,
      preferredTimeSlots: parsed.data.preferred_time_slots,
      createdAt: new Date(),
      distanceKm: parsed.data.distance_km ?? null,
      preferredProvider: parsed.data.preferred_provider ?? null,
      paymentCategory: parsed.data.payment_category ?? null,
    });

    const { data, error } = await supabase
      .from("waitlist_entries")
      .insert({
        tenant_id: auth.data.tenantId,
        ...parsed.data,
        priority_score: priority.score,
        priority_reason: priority.reason,
        smart_score: smartScore.total,
        smart_score_breakdown: smartScore,
      })
      .select("*, patient:patients(*)")
      .single();

    if (error) {
      console.error("Waitlist insert error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to create waitlist entry" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("Waitlist POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
