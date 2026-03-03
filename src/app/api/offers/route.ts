import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { OffersFiltersSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const filters = OffersFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!filters.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: filters.error.message } },
        { status: 400 }
      );
    }

    const { status, page, pageSize } = filters.data;
    const supabase = await createClient();

    let query = supabase
      .from("waitlist_offers")
      .select(
        `id, status, smart_score, smart_score_breakdown, offered_at, expires_at, responded_at, created_at, updated_at,
         patient:patients(id, first_name, last_name, phone, email, preferred_channel),
         waitlist_entry:waitlist_entries(id, service_name, clinical_urgency, smart_score),
         original_appointment:appointments(id, service_name, scheduled_at, duration_min, provider_name, location_name)`,
        { count: "exact" }
      )
      .eq("tenant_id", auth.data.tenantId)
      .order("offered_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) {
      console.error("Offers fetch error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to fetch offers" } },
        { status: 500 }
      );
    }

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
    console.error("Offers GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
