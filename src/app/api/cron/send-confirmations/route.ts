/**
 * Cron: Send confirmation messages (every 5 min).
 * Picks up pending_send workflows past their deadline and sends WhatsApp/SMS.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { markMessageSent } from "@/lib/confirmation/workflow";
import { sendMessage } from "@/lib/messaging/send-message";
import { renderConfirmationWhatsApp, renderConfirmationSms } from "@/lib/confirmation/templates";
import type { MessageChannel } from "@/lib/types";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  // Fetch workflows ready to send (past deadline, still pending_send)
  const { data: workflows, error } = await supabase
    .from("confirmation_workflows")
    .select(`
      id, tenant_id, appointment_id,
      appointment:appointments(
        id, service_name, provider_name, location_name, scheduled_at,
        patient:patients(id, first_name, last_name, phone, preferred_channel)
      )
    `)
    .eq("state", "pending_send")
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
      const body =
        channel === "whatsapp"
          ? renderConfirmationWhatsApp(vars)
          : renderConfirmationSms(vars);

      const result = await sendMessage(supabase, {
        tenantId: wf.tenant_id,
        patientId: patient.id as string,
        patientPhone: patient.phone as string,
        channel,
        body,
        contextAppointmentId: wf.appointment_id,
      });

      if (result.success && result.message) {
        await markMessageSent(supabase, wf.id, result.message.id);
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
