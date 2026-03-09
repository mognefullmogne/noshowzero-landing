// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { PublicCreateWaitlistSchema, PublicWaitlistFiltersSchema } from "@/lib/validations";
import { calculateInitialPriority, computeWaitlistScore } from "@/lib/scoring/waitlist-score";

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const filters = PublicWaitlistFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!filters.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: filters.error.message } },
        { status: 400 }
      );
    }

    const { status, service_name, limit, page } = filters.data;
    const supabase = await createServiceClient();

    let query = supabase
      .from("waitlist_entries")
      .select(
        "id, status, service_name, clinical_urgency, preferred_provider, preferred_time_slots, flexible_time, smart_score, smart_score_breakdown, priority_score, valid_until, max_offers, created_at, patient:patients(id, external_id, first_name, last_name, phone, email)",
        { count: "exact" }
      )
      .eq("tenant_id", auth.tenantId)
      .order("priority_score", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq("status", status);
    if (service_name) query = query.ilike("service_name", `%${service_name}%`);

    const { data, count, error } = await query;
    if (error) {
      console.error("v1 waitlist GET error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to fetch waitlist" } },
        { status: 500 }
      );
    }

    const total = count ?? 0;
    return NextResponse.json({
      success: true,
      data: data ?? [],
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("v1 waitlist GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = PublicCreateWaitlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const { tenantId } = auth;

    // Look up patient by external_id + tenant_id
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("external_id", parsed.data.patient_external_id)
      .maybeSingle();

    if (!patient) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Patient not found. Create the patient first via POST /api/v1/patients." } },
        { status: 404 }
      );
    }

    // Map urgency to clinical_urgency format
    const clinicalUrgency = parsed.data.urgency ?? "none";

    // Calculate initial priority
    const priority = calculateInitialPriority({
      flexibleTime: true,
      clinicalUrgency,
    });

    // Get patient history for smart score
    const { count: totalAppts } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patient.id)
      .eq("tenant_id", tenantId);

    const { count: noShows } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patient.id)
      .eq("tenant_id", tenantId)
      .eq("status", "no_show");

    const smartScore = computeWaitlistScore({
      clinicalUrgency,
      patientNoShows: noShows ?? 0,
      patientTotal: totalAppts ?? 0,
      preferredTimeSlots: [],
      createdAt: new Date(),
      distanceKm: null,
      preferredProvider: parsed.data.preferred_providers?.[0] ?? null,
      paymentCategory: null,
    });

    const { data: entry, error } = await supabase
      .from("waitlist_entries")
      .insert({
        tenant_id: tenantId,
        patient_id: patient.id,
        service_name: parsed.data.service_name,
        preferred_provider: parsed.data.preferred_providers?.[0],
        preferred_time_slots: [],
        flexible_time: true,
        clinical_urgency: clinicalUrgency,
        notes: parsed.data.notes,
        priority_score: priority.score,
        priority_reason: priority.reason,
        smart_score: smartScore.total,
        smart_score_breakdown: smartScore,
      })
      .select("id, status, service_name, clinical_urgency, smart_score, priority_score, created_at")
      .single();

    if (error) {
      console.error("v1 waitlist POST error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to create waitlist entry" } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: entry.id,
          status: entry.status,
          service_name: entry.service_name,
          clinical_urgency: entry.clinical_urgency,
          smart_score: entry.smart_score,
          priority_score: entry.priority_score,
          created_at: entry.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("v1 waitlist POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
