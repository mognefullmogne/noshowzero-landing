// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import {
  CreateAppointmentSchema,
  InlineCreateAppointmentSchema,
  AppointmentFiltersSchema,
} from "@/lib/validations";
import { computeRiskScore } from "@/lib/scoring/risk-score";
import { generateContactSchedule, scheduleToReminders } from "@/lib/scoring/contact-timing";
import { createConfirmationWorkflow } from "@/lib/confirmation/workflow";
import { calculateConfirmationDeadline } from "@/lib/confirmation/timing";
import { sendMessage } from "@/lib/messaging/send-message";
import { markMessageSent } from "@/lib/confirmation/workflow";
import { renderConfirmationWhatsApp, renderConfirmationSms } from "@/lib/confirmation/templates";
import { CONTENT_SIDS, buildConfirmationVars } from "@/lib/twilio/content-templates";
import { maybeProcessPending } from "@/lib/engine/process-pending";
import { autoScoreAppointments } from "@/lib/scoring/auto-score";
import type { Patient, MessageChannel } from "@/lib/types";
import { checkProviderConflict } from "@/lib/booking/provider-conflict";
import { logAuditEvent } from "@/lib/audit/log-event";

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

    const { status, date, from, to, patient_id, page, pageSize } = filters.data;
    const supabase = await createClient();

    let query = supabase
      .from("appointments")
      .select("*, patient:patients(*)", { count: "exact" })
      .eq("tenant_id", auth.data.tenantId)
      .order("scheduled_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (status) query = query.eq("status", status);
    if (date) {
      query = query.gte("scheduled_at", `${date}T00:00:00.000Z`).lte("scheduled_at", `${date}T23:59:59.999Z`);
    } else {
      if (from) query = query.gte("scheduled_at", from);
      if (to) query = query.lte("scheduled_at", to);
    }
    if (patient_id) query = query.eq("patient_id", patient_id);

    const { data, count, error } = await query;
    if (error) {
      console.error("Appointments fetch error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to fetch appointments" } },
        { status: 500 }
      );
    }

    // Fire-and-forget: opportunistic scoring + engine
    autoScoreAppointments(supabase, auth.data.tenantId);
    maybeProcessPending(supabase, auth.data.tenantId);

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
    const supabase = await createClient();

    // Try inline schema first (dashboard form), fall back to legacy schema (API/programmatic)
    const inlineParsed = InlineCreateAppointmentSchema.safeParse(body);
    const legacyParsed = CreateAppointmentSchema.safeParse(body);

    let patientId: string;
    let preferredChannel: MessageChannel = "email";
    let appointmentData: {
      service_name: string;
      service_id?: string;
      provider_name?: string;
      operator_id?: string;
      location_name?: string;
      scheduled_at: string;
      duration_min: number;
      notes?: string;
      service_code?: string;
      payment_category?: string;
      external_id?: string;
    };

    if (inlineParsed.success) {
      // --- Inline flow: create or find patient, then create appointment ---
      const { patient: patientInfo, ...apptInfo } = inlineParsed.data;

      // Try to find existing patient by name + contact
      let matchQuery = supabase
        .from("patients")
        .select("id, preferred_channel")
        .eq("tenant_id", auth.data.tenantId)
        .eq("is_active", true)
        .ilike("first_name", patientInfo.first_name.trim())
        .ilike("last_name", patientInfo.last_name.trim());

      if (patientInfo.phone) {
        matchQuery = matchQuery.eq("phone", patientInfo.phone.trim());
      } else if (patientInfo.email) {
        matchQuery = matchQuery.eq("email", patientInfo.email.trim());
      }

      const { data: existingPatient } = await matchQuery.maybeSingle();

      if (existingPatient) {
        patientId = existingPatient.id;
        preferredChannel = (existingPatient.preferred_channel ?? patientInfo.preferred_channel) as MessageChannel;
      } else {
        // Create new patient
        const { data: newPatient, error: patientError } = await supabase
          .from("patients")
          .insert({
            tenant_id: auth.data.tenantId,
            first_name: patientInfo.first_name.trim(),
            last_name: patientInfo.last_name.trim(),
            phone: patientInfo.phone?.trim() || null,
            email: patientInfo.email?.trim() || null,
            preferred_channel: patientInfo.preferred_channel,
          })
          .select("id, preferred_channel")
          .single();

        if (patientError || !newPatient) {
          console.error("Patient insert error:", patientError);
          return NextResponse.json(
            { success: false, error: { code: "DB_ERROR", message: "Failed to create patient" } },
            { status: 500 }
          );
        }
        patientId = newPatient.id;
        preferredChannel = (newPatient.preferred_channel ?? patientInfo.preferred_channel) as MessageChannel;
      }

      // Parse scheduled_at — the form sends datetime-local format (no timezone)
      const scheduledDate = new Date(apptInfo.scheduled_at);
      appointmentData = {
        service_name: apptInfo.service_name,
        service_id: apptInfo.service_id,
        provider_name: apptInfo.provider_name,
        operator_id: apptInfo.operator_id,
        location_name: apptInfo.location_name,
        scheduled_at: scheduledDate.toISOString(),
        duration_min: apptInfo.duration_min,
        notes: apptInfo.notes,
      };
    } else if (legacyParsed.success) {
      // --- Legacy flow: patient_id provided directly ---
      const { data: patient } = await supabase
        .from("patients")
        .select("id, preferred_channel")
        .eq("id", legacyParsed.data.patient_id)
        .eq("tenant_id", auth.data.tenantId)
        .maybeSingle();

      if (!patient) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "Patient not found" } },
          { status: 404 }
        );
      }
      patientId = patient.id;
      preferredChannel = ((patient as Patient).preferred_channel ?? "email") as MessageChannel;
      appointmentData = {
        service_name: legacyParsed.data.service_name,
        provider_name: legacyParsed.data.provider_name,
        location_name: legacyParsed.data.location_name,
        scheduled_at: legacyParsed.data.scheduled_at,
        duration_min: legacyParsed.data.duration_min,
        notes: legacyParsed.data.notes,
        service_code: legacyParsed.data.service_code,
        payment_category: legacyParsed.data.payment_category,
        external_id: legacyParsed.data.external_id,
      };
    } else {
      // Neither schema matched — return generic message, log details server-side
      console.error("Validation error (inline):", inlineParsed.error.message, "legacy:", legacyParsed.error.message);
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body. Please check all required fields." } },
        { status: 400 }
      );
    }

    // Prevent double-booking: check if provider already has an appointment at this time
    const conflict = await checkProviderConflict(supabase, {
      tenantId: auth.data.tenantId,
      providerName: appointmentData.provider_name,
      scheduledAt: appointmentData.scheduled_at,
      durationMin: appointmentData.duration_min,
    });

    if (conflict.hasConflict) {
      const c = conflict.conflicting;
      const when = c ? new Date(c.scheduled_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PROVIDER_CONFLICT",
            message: `${appointmentData.provider_name ?? "Il professionista"} ha già un appuntamento alle ${when}. Non è possibile sovrapporre appuntamenti per lo stesso professionista.`,
          },
        },
        { status: 409 }
      );
    }

    // Count history for risk scoring
    const { count: totalAppts } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("tenant_id", auth.data.tenantId);

    const { count: noShows } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("tenant_id", auth.data.tenantId)
      .eq("status", "no_show");

    const now = new Date();
    const scheduledAt = new Date(appointmentData.scheduled_at);

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
        patient_id: patientId,
        ...appointmentData,
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

    // Schedule reminders
    const schedule = generateContactSchedule(riskResult.score, preferredChannel);
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
      const { error: reminderError } = await supabase.from("reminders").insert(reminderRows);
      if (reminderError) {
        console.error("[Appointments] Failed to insert reminders:", reminderError, {
          appointmentId: appointment.id,
          count: reminderRows.length,
        });
      }
    }

    // Create confirmation workflow and, if the send window is already open, send immediately.
    createAndMaybeSendConfirmation(
      supabase,
      auth.data.tenantId,
      appointment.id,
      scheduledAt,
      riskResult.score,
      patientId,
      preferredChannel,
      {
        service_name: appointmentData.service_name,
        provider_name: appointmentData.provider_name ?? null,
        location_name: appointmentData.location_name ?? null,
      }
    ).catch((err) => console.error("[Appointments] Confirmation workflow error:", err));

    logAuditEvent({
      tenantId: auth.data.tenantId,
      actorType: "user",
      actorId: auth.data.userId,
      entityType: "appointment",
      entityId: appointment.id,
      action: "appointment.created",
      metadata: { service_name: appointmentData.service_name, patient_id: patientId },
    });

    return NextResponse.json({ success: true, data: appointment }, { status: 201 });
  } catch (err) {
    console.error("Appointments POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helper: create confirmation workflow and send immediately if window is open
// ---------------------------------------------------------------------------

/**
 * Create a confirmation workflow for a new appointment.
 * If the send deadline is already in the past (i.e., the appointment is close enough
 * that we should confirm right now), send the message immediately rather than waiting
 * for the cron or opportunistic engine to pick it up.
 */
async function createAndMaybeSendConfirmation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  appointmentId: string,
  scheduledAt: Date,
  riskScore: number,
  patientId: string,
  preferredChannel: MessageChannel,
  apptMeta: {
    service_name: string;
    provider_name: string | null;
    location_name: string | null;
  }
): Promise<void> {
  // Calculate when we should send (based on risk score)
  const sendDeadline = calculateConfirmationDeadline(scheduledAt, riskScore);
  const now = new Date();

  // Create the workflow record
  const workflowId = await createConfirmationWorkflow(
    supabase,
    tenantId,
    appointmentId,
    scheduledAt,
    riskScore
  );

  // If the send deadline is already passed (appointment is soon enough), send now
  if (workflowId && sendDeadline <= now) {
    const { data: patient } = await supabase
      .from("patients")
      .select("id, first_name, last_name, phone, preferred_channel")
      .eq("id", patientId)
      .maybeSingle();

    if (!patient?.phone) return;

    const dateStr = scheduledAt.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const timeStr = scheduledAt.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const vars = {
      patientName: `${patient.first_name} ${patient.last_name}`,
      serviceName: apptMeta.service_name,
      date: dateStr,
      time: timeStr,
      providerName: apptMeta.provider_name ?? undefined,
      locationName: apptMeta.location_name ?? undefined,
    };

    const channel = preferredChannel;
    const body =
      channel === "whatsapp"
        ? renderConfirmationWhatsApp(vars)
        : renderConfirmationSms(vars);

    const contentSid = channel === "whatsapp" ? CONTENT_SIDS.appointment_confirmation : undefined;
    const contentVariables = channel === "whatsapp"
      ? buildConfirmationVars({
          patientName: vars.patientName,
          serviceName: vars.serviceName,
          date: vars.date,
          time: vars.time,
        })
      : undefined;

    const result = await sendMessage(supabase, {
      tenantId,
      patientId: patient.id,
      patientPhone: patient.phone,
      channel,
      body,
      contextAppointmentId: appointmentId,
      contentSid,
      contentVariables,
    });

    if (result.success && result.message) {
      await markMessageSent(supabase, workflowId, result.message.id);
      console.info(
        `[Appointments] Conferma inviata immediatamente per appuntamento ${appointmentId}`
      );
    } else {
      console.error(
        "[Appointments] Invio conferma immediata fallito:",
        appointmentId,
        result.error
      );
    }
  }
}
