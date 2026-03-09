// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Cron: Send confirmation messages (every 5 min).
 * Picks up pending_send workflows past their deadline and sends WhatsApp/SMS.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { markMessageSent } from "@/lib/confirmation/workflow";
import { sendMessage } from "@/lib/messaging/send-message";
import { renderConfirmationWhatsApp, renderConfirmationSms } from "@/lib/confirmation/templates";
import { personalizeConfirmationMessage } from "@/lib/scoring/ai-confirmation-personalizer";
import { CONTENT_SIDS, buildConfirmationVars } from "@/lib/twilio/content-templates";
import type { MessageChannel } from "@/lib/types";
import { verifyCronSecret } from "@/lib/cron-auth";
import { dispatchWebhookEvent } from "@/lib/webhooks/outbound";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  // Fetch workflows ready for Touch 1 confirmation (SI/NO).
  // Picks up notification_sent (notification already sent, deadline reached)
  // and pending_send (notification was never sent, e.g. deadline already passed at creation).
  const { data: workflows, error } = await supabase
    .from("confirmation_workflows")
    .select(`
      id, tenant_id, appointment_id,
      appointment:appointments(
        id, service_name, provider_name, location_name, scheduled_at, risk_score, patient_id,
        patient:patients(id, first_name, last_name, phone, preferred_channel)
      )
    `)
    .in("state", ["notification_sent", "pending_send"])
    .lte("deadline_at", now)
    .limit(50);

  if (error) {
    console.error("[Cron] send-confirmations query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const wf of workflows ?? []) {
    try {
      const appt = wf.appointment as unknown as Record<string, unknown>;
      const patient = appt?.patient as unknown as Record<string, unknown>;

      if (!patient?.phone) {
        failed++;
        continue;
      }

      const scheduledAt = new Date(appt.scheduled_at as string);
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
        serviceName: appt.service_name as string,
        date: dateStr,
        time: timeStr,
        providerName: (appt.provider_name as string) ?? undefined,
        locationName: (appt.location_name as string) ?? undefined,
      };

      const channel = (patient.preferred_channel as MessageChannel) ?? "whatsapp";
      const riskScore = typeof appt.risk_score === "number" ? appt.risk_score : null;

      // WhatsApp initial confirmation: MUST use Content SID template (outside 24h window).
      // AI personalization only applies to SMS where freeform text is always allowed.
      let body: string;
      let contentSid: string | undefined;
      let contentVariables: string | undefined;

      if (channel === "whatsapp") {
        // Use approved WhatsApp template — required outside conversation window
        contentSid = CONTENT_SIDS.appointment_confirmation;
        contentVariables = buildConfirmationVars({
          patientName: vars.patientName,
          serviceName: vars.serviceName,
          date: vars.date,
          time: vars.time,
        });
        body = renderConfirmationWhatsApp(vars); // fallback body for SMS retry
      } else if (riskScore !== null && process.env.ANTHROPIC_API_KEY) {
        // SMS: AI personalization when risk score available
        const { count: noShowCount } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", appt.patient_id as string)
          .eq("tenant_id", wf.tenant_id)
          .eq("status", "no_show");

        const { count: totalCount } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", appt.patient_id as string)
          .eq("tenant_id", wf.tenant_id);

        const personalizeResult = await personalizeConfirmationMessage(
          {
            patientName: `${patient.first_name} ${patient.last_name}`,
            serviceName: appt.service_name as string,
            providerName: (appt.provider_name as string) ?? null,
            locationName: (appt.location_name as string) ?? null,
            scheduledAt,
            riskScore,
            previousNoShows: noShowCount ?? 0,
            totalAppointments: totalCount ?? 0,
          },
          "sms"
        );

        body = personalizeResult.message;
      } else {
        body = renderConfirmationSms(vars);
      }

      const result = await sendMessage(supabase, {
        tenantId: wf.tenant_id,
        patientId: patient.id as string,
        patientPhone: patient.phone as string,
        channel,
        body,
        contextAppointmentId: wf.appointment_id,
        contentSid,
        contentVariables,
      });

      if (result.success && result.message) {
        await markMessageSent(supabase, wf.id, result.message.id);
        // Dispatch webhook for reminder sent
        try {
          await dispatchWebhookEvent(wf.tenant_id, "reminder.sent", {
            workflow_id: wf.id,
            appointment_id: wf.appointment_id,
            patient_id: patient.id as string,
            channel,
            sent_at: new Date().toISOString(),
          });
        } catch { /* webhook delivery is best-effort */ }
        sent++;
      } else {
        failed++;
        // Log failure
        await supabase.from("failed_jobs").insert({
          tenant_id: wf.tenant_id,
          job_type: "send_confirmation",
          job_payload: { workflow_id: wf.id, appointment_id: wf.appointment_id },
          error_message: result.error ?? "Unknown send failure",
        });
      }
    } catch (err) {
      failed++;
      console.error("[Cron] send-confirmation error for workflow:", wf.id, err);
    }
  }

  return NextResponse.json({ sent, failed, total: (workflows ?? []).length });
}
