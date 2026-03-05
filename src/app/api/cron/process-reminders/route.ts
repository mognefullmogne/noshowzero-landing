import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureRemindersScheduled } from "@/lib/reminders/schedule-reminders";
import { sendMessage } from "@/lib/messaging/send-message";
import { renderReminderWhatsApp, renderReminderSms } from "@/lib/reminders/templates";
import { verifyCronSecret } from "@/lib/cron-auth";
import { autoScoreAppointments, autoScoreWaitlistEntries } from "@/lib/scoring/auto-score";
import type { MessageChannel } from "@/lib/types";

/**
 * Cron job (every 15 min) to:
 * 1. Process pending reminders that are due — send via Twilio
 * 2. Safety-net: schedule reminders for appointments in the next 72h that have none
 *
 * Protected by CRON_SECRET env var.
 */
export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = await createServiceClient();
    const now = new Date();
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let scheduled = 0;

    // 1. Find due reminders with full appointment + patient data
    const { data: dueReminders } = await supabase
      .from("reminders")
      .select(
        "id, tenant_id, appointment_id, channel, message_tone, appointment:appointments(id, service_name, provider_name, location_name, scheduled_at, status, patient:patients(id, first_name, last_name, phone, email, preferred_channel))"
      )
      .eq("status", "pending")
      .lte("scheduled_at", now.toISOString())
      .limit(50);

    if (dueReminders && dueReminders.length > 0) {
      for (const reminder of dueReminders) {
        const appt = reminder.appointment as unknown as Record<string, unknown> | null;

        // Skip orphaned reminders (no appointment)
        if (!appt) {
          await supabase
            .from("reminders")
            .update({ status: "cancelled", sent_at: now.toISOString() })
            .eq("id", reminder.id);
          skipped++;
          continue;
        }

        // Skip reminders for appointments that are no longer active
        const apptStatus = appt.status as string;
        if (["completed", "no_show", "cancelled"].includes(apptStatus)) {
          await supabase
            .from("reminders")
            .update({ status: "cancelled", sent_at: now.toISOString() })
            .eq("id", reminder.id);
          skipped++;
          continue;
        }

        const patient = appt.patient as unknown as Record<string, string> | null;
        if (!patient) {
          await supabase
            .from("reminders")
            .update({ status: "cancelled", sent_at: now.toISOString() })
            .eq("id", reminder.id);
          skipped++;
          continue;
        }

        // Determine the right channel and contact info
        const hasPhone = Boolean(patient.phone && patient.phone.trim());
        const hasEmail = Boolean(patient.email && patient.email.trim());

        if (!hasPhone && !hasEmail) {
          console.warn(`[Reminders] No contact info for reminder ${reminder.id}, patient ${patient.id}`);
          await supabase
            .from("reminders")
            .update({ status: "cancelled", sent_at: now.toISOString() })
            .eq("id", reminder.id);
          skipped++;
          continue;
        }

        // Only send WhatsApp/SMS if patient has a phone number; skip if email-only
        let channel: MessageChannel;
        let contactValue: string;
        if (hasPhone) {
          channel = (reminder.channel ?? patient.preferred_channel ?? "whatsapp") as MessageChannel;
          // Force to whatsapp/sms if channel was email but patient has phone
          if (channel === "email") channel = "sms";
          contactValue = patient.phone.trim();
        } else {
          // Email-only patient — can't send WhatsApp/SMS, skip for now
          // (email sending via SendGrid not yet integrated)
          console.warn(`[Reminders] Patient ${patient.id} has email only, skipping reminder ${reminder.id}`);
          await supabase
            .from("reminders")
            .update({ status: "cancelled", sent_at: now.toISOString() })
            .eq("id", reminder.id);
          skipped++;
          continue;
        }

        // Build message from template
        const scheduledAt = new Date(appt.scheduled_at as string);
        const tone = (reminder.message_tone ?? "standard") as "standard" | "urgent";

        const vars = {
          patientName: `${patient.first_name} ${patient.last_name}`,
          serviceName: appt.service_name as string,
          providerName: (appt.provider_name as string) || undefined,
          locationName: (appt.location_name as string) || undefined,
          date: scheduledAt.toLocaleDateString("it-IT", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }),
          time: scheduledAt.toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          tone,
        };

        const body =
          channel === "whatsapp"
            ? renderReminderWhatsApp(vars)
            : renderReminderSms(vars);

        // Send via Twilio
        const result = await sendMessage(supabase, {
          tenantId: reminder.tenant_id,
          patientId: patient.id,
          patientPhone: contactValue,
          channel,
          body,
          contextAppointmentId: reminder.appointment_id,
        });

        if (result.success) {
          // Mark reminder as sent only on success
          await supabase
            .from("reminders")
            .update({ status: "sent", sent_at: now.toISOString() })
            .eq("id", reminder.id);

          // Update appointment status to reminder_sent
          if (["scheduled", "reminder_pending"].includes(apptStatus)) {
            await supabase
              .from("appointments")
              .update({ status: "reminder_sent" })
              .eq("id", reminder.appointment_id)
              .in("status", ["scheduled", "reminder_pending"]);
          }

          sent++;
        } else {
          // Leave as pending so it retries on next cron run
          console.error(`[Reminders] Failed to send reminder ${reminder.id}:`, result.error);
          failed++;
        }
      }
    }

    // 2. Auto-score unscored records across all tenants with upcoming appointments
    const { data: tenantIds } = await supabase
      .from("appointments")
      .select("tenant_id")
      .is("risk_score", null)
      .in("status", ["scheduled", "reminder_pending", "reminder_sent", "confirmed"])
      .limit(10);

    const uniqueTenants = [...new Set((tenantIds ?? []).map((r: { tenant_id: string }) => r.tenant_id))];
    for (const tid of uniqueTenants) {
      await autoScoreAppointments(supabase, tid);
      await autoScoreWaitlistEntries(supabase, tid);
    }

    // 3. Safety net — find appointments in next 72h without any reminders
    const cutoff = new Date(now.getTime() + 72 * 3_600_000);
    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, tenant_id, scheduled_at, risk_score, patient:patients(preferred_channel)")
      .in("status", ["scheduled", "reminder_pending"])
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", cutoff.toISOString())
      .limit(50);

    if (appointments) {
      for (const appt of appointments) {
        const patientData = appt.patient as unknown as {
          preferred_channel?: string;
        } | null;
        const channel = (patientData?.preferred_channel ?? "whatsapp") as MessageChannel;
        const count = await ensureRemindersScheduled(supabase, {
          appointmentId: appt.id,
          tenantId: appt.tenant_id,
          scheduledAt: new Date(appt.scheduled_at),
          riskScore: appt.risk_score ?? 30,
          preferredChannel: channel,
        });
        scheduled += count;
      }
    }

    return NextResponse.json({
      success: true,
      data: { sent, failed, skipped, scheduled, timestamp: now.toISOString() },
    });
  } catch (err) {
    console.error("Cron process-reminders error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
