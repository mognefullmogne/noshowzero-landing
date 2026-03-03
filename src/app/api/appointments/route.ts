import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { CreateAppointmentSchema, AppointmentFiltersSchema } from "@/lib/validations";
import { computeRiskScore } from "@/lib/scoring/risk-score";
import { generateContactSchedule, scheduleToReminders } from "@/lib/scoring/contact-timing";
import type { Patient } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const filters = AppointmentFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!filters.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: filters.error.message } },
        { status: 400 }
      );
    }

    const { status, from, to, patient_id, page, pageSize } = filters.data;
    const supabase = await createClient();

    let query = supabase
      .from("appointments")
      .select("*, patient:patients(*)", { count: "exact" })
      .eq("tenant_id", auth.data.tenantId)
      .order("scheduled_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (status) query = query.eq("status", status);
    if (from) query = query.gte("scheduled_at", from);
    if (to) query = query.lte("scheduled_at", to);
    if (patient_id) query = query.eq("patient_id", patient_id);

    const { data, count, error } = await query;
    if (error) {
      console.error("Appointments fetch error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to fetch appointments" } },
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
    console.error("Appointments GET error:", err);
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
    const parsed = CreateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch patient history for risk scoring
    const { data: patient } = await supabase
      .from("patients")
      .select("id, preferred_channel")
      .eq("id", parsed.data.patient_id)
      .eq("tenant_id", auth.data.tenantId)
      .maybeSingle();

    if (!patient) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Patient not found" } },
        { status: 404 }
      );
    }

    // Count historical appointments for risk score
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

    const now = new Date();
    const scheduledAt = new Date(parsed.data.scheduled_at);

    const riskResult = computeRiskScore({
      totalAppointments: totalAppts ?? 0,
      noShows: noShows ?? 0,
      scheduledAt,
      createdAt: now,
    });

    // Insert appointment
    const { data: appointment, error: insertError } = await supabase
      .from("appointments")
      .insert({
        tenant_id: auth.data.tenantId,
        ...parsed.data,
        risk_score: riskResult.score,
        risk_reasoning: riskResult.reasoning,
        risk_scored_at: now.toISOString(),
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Appointment insert error:", insertError);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to create appointment" } },
        { status: 500 }
      );
    }

    // Schedule reminders based on risk score
    const schedule = generateContactSchedule(
      riskResult.score,
      (patient as Patient).preferred_channel ?? "email"
    );
    const reminderTimes = scheduleToReminders(scheduledAt, schedule);

    if (reminderTimes.length > 0) {
      const reminderRows = reminderTimes.map((r) => ({
        tenant_id: auth.data.tenantId,
        appointment_id: appointment.id,
        channel: r.channel,
        message_tone: r.messageTone,
        scheduled_at: r.scheduledAt.toISOString(),
        status: "pending",
      }));
      await supabase.from("reminders").insert(reminderRows);
    }

    return NextResponse.json({ success: true, data: appointment }, { status: 201 });
  } catch (err) {
    console.error("Appointments POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
