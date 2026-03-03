import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { PublicCreateAppointmentSchema } from "@/lib/validations";
import { computeRiskScore } from "@/lib/scoring/risk-score";
import { generateContactSchedule, scheduleToReminders } from "@/lib/scoring/contact-timing";

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
    const parsed = PublicCreateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const { tenantId } = auth;

    // Upsert patient by external_id
    const { data: existingPatient } = await supabase
      .from("patients")
      .select("id, preferred_channel")
      .eq("tenant_id", tenantId)
      .eq("external_id", parsed.data.patient.external_id)
      .maybeSingle();

    let patientId: string;
    let preferredChannel = "email";

    if (existingPatient) {
      patientId = existingPatient.id;
      preferredChannel = existingPatient.preferred_channel;
      // Update patient info
      await supabase
        .from("patients")
        .update({
          first_name: parsed.data.patient.first_name,
          last_name: parsed.data.patient.last_name,
          phone: parsed.data.patient.phone,
          email: parsed.data.patient.email,
        })
        .eq("id", patientId);
    } else {
      const { data: newPatient, error: pErr } = await supabase
        .from("patients")
        .insert({
          tenant_id: tenantId,
          external_id: parsed.data.patient.external_id,
          first_name: parsed.data.patient.first_name,
          last_name: parsed.data.patient.last_name,
          phone: parsed.data.patient.phone,
          email: parsed.data.patient.email,
        })
        .select("id")
        .single();

      if (pErr || !newPatient) {
        return NextResponse.json(
          { success: false, error: { code: "DB_ERROR", message: "Failed to create patient" } },
          { status: 500 }
        );
      }
      patientId = newPatient.id;
    }

    // Check for duplicate external_id
    const { data: existing } = await supabase
      .from("appointments")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("external_id", parsed.data.external_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        data: { id: existing.id, status: existing.status, message: "Appointment already exists" },
      });
    }

    // Count history for risk score
    const { count: totalAppts } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("tenant_id", tenantId);

    const { count: noShows } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("tenant_id", tenantId)
      .eq("status", "no_show");

    const now = new Date();
    const scheduledAt = new Date(parsed.data.scheduled_at);

    const riskResult = computeRiskScore({
      totalAppointments: totalAppts ?? 0,
      noShows: noShows ?? 0,
      scheduledAt,
      createdAt: now,
    });

    const { data: appointment, error: aErr } = await supabase
      .from("appointments")
      .insert({
        tenant_id: tenantId,
        patient_id: patientId,
        external_id: parsed.data.external_id,
        service_name: parsed.data.service_name,
        service_code: parsed.data.service_code,
        provider_name: parsed.data.provider_name,
        location_name: parsed.data.location_name,
        scheduled_at: parsed.data.scheduled_at,
        duration_min: parsed.data.duration_min,
        payment_category: parsed.data.payment_category,
        notes: parsed.data.notes,
        risk_score: riskResult.score,
        risk_reasoning: riskResult.reasoning,
        risk_scored_at: now.toISOString(),
      })
      .select("id, status, risk_score, scheduled_at, created_at")
      .single();

    if (aErr || !appointment) {
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to create appointment" } },
        { status: 500 }
      );
    }

    // Schedule reminders
    const schedule = generateContactSchedule(riskResult.score, preferredChannel as "email" | "sms" | "whatsapp");
    const reminderTimes = scheduleToReminders(scheduledAt, schedule);
    if (reminderTimes.length > 0) {
      await supabase.from("reminders").insert(
        reminderTimes.map((r) => ({
          tenant_id: tenantId,
          appointment_id: appointment.id,
          channel: r.channel,
          message_tone: r.messageTone,
          scheduled_at: r.scheduledAt.toISOString(),
          status: "pending",
        }))
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: appointment.id,
          status: appointment.status,
          risk_score: appointment.risk_score,
          reminders_scheduled: reminderTimes.length,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("v1 appointments POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
