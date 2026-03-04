/**
 * POST /api/appointments/[id]/send-confirmation — Manually send a confirmation message to the patient.
 * Uses the same template and channel as the automated confirmation cron.
 * Includes a 5-minute cooldown to prevent duplicate sends.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { sendNotification } from "@/lib/twilio/send-notification";
import {
  renderConfirmationWhatsApp,
  renderConfirmationSms,
} from "@/lib/confirmation/templates";
import type { MessageChannel } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESEND_COOLDOWN_MINUTES = 5;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "Invalid appointment ID" } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch appointment with patient data
    const { data: appointment } = await supabase
      .from("appointments")
      .select(
        "id, service_name, provider_name, location_name, scheduled_at, confirmation_sent_at, patient:patients(id, first_name, last_name, phone, preferred_channel)"
      )
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .maybeSingle();

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    // Cooldown guard — prevent duplicate sends within 5 minutes
    if (appointment.confirmation_sent_at) {
      const lastSent = new Date(appointment.confirmation_sent_at);
      const minutesSince = (Date.now() - lastSent.getTime()) / 60_000;
      if (minutesSince < RESEND_COOLDOWN_MINUTES) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "TOO_SOON",
              message: `Confirmation already sent ${Math.ceil(minutesSince)} min ago. Please wait ${RESEND_COOLDOWN_MINUTES} minutes between sends.`,
            },
          },
          { status: 429 }
        );
      }
    }

    const patient = appointment.patient as unknown as {
      id: string;
      first_name: string;
      last_name: string;
      phone: string | null;
      preferred_channel: MessageChannel;
    } | null;

    if (!patient?.phone) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_PHONE",
            message: "Patient has no phone number — cannot send confirmation",
          },
        },
        { status: 422 }
      );
    }

    // Build template variables
    const scheduledAt = new Date(appointment.scheduled_at);
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
      serviceName: appointment.service_name,
      date: dateStr,
      time: timeStr,
      providerName: appointment.provider_name ?? undefined,
      locationName: appointment.location_name ?? undefined,
    };

    // Use WhatsApp template only for whatsapp channel; SMS template for sms and email fallback
    const channel: MessageChannel = patient.preferred_channel ?? "whatsapp";
    const body =
      channel === "whatsapp"
        ? renderConfirmationWhatsApp(vars)
        : renderConfirmationSms(vars);

    // Delivery channel — email falls back to SMS
    const deliveryChannel: "whatsapp" | "sms" = channel === "whatsapp" ? "whatsapp" : "sms";

    // Send via Twilio (with retry + fallback)
    const result = await sendNotification({
      to: patient.phone,
      body,
      channel: deliveryChannel,
      tenantId: auth.data.tenantId,
    });

    if (result.status === "failed") {
      console.error("[send-confirmation] Twilio delivery failed:", result.errorMessage);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SEND_FAILED",
            message: `Send failed: ${result.errorMessage ?? "unknown error"} (provider: ${result.provider})`,
          },
        },
        { status: 502 }
      );
    }

    // Update confirmation_sent_at on the appointment
    await supabase
      .from("appointments")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId);

    return NextResponse.json({
      success: true,
      data: {
        delivery_channel: deliveryChannel,
        message: "Confirmation sent successfully",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Send-confirmation POST error:", msg);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: `Error: ${msg}` } },
      { status: 500 }
    );
  }
}
