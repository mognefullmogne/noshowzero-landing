import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { generateContactSchedule, scheduleToReminders } from "@/lib/scoring/contact-timing";
import type { Patient } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const supabase = await createClient();

    const { data: appointment } = await supabase
      .from("appointments")
      .select("id, scheduled_at, risk_score, patient:patients(preferred_channel)")
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .maybeSingle();

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    const patientData = appointment.patient as unknown as Patient | null;
    const channel = patientData?.preferred_channel ?? "email";
    const riskScore = appointment.risk_score ?? 30;

    const schedule = generateContactSchedule(riskScore, channel);
    const reminderTimes = scheduleToReminders(new Date(appointment.scheduled_at), schedule);

    if (reminderTimes.length === 0) {
      return NextResponse.json({
        success: true,
        data: { reminders_created: 0, message: "No future reminders to schedule" },
      });
    }

    const rows = reminderTimes.map((r) => ({
      tenant_id: auth.data.tenantId,
      appointment_id: id,
      channel: r.channel,
      message_tone: r.messageTone,
      scheduled_at: r.scheduledAt.toISOString(),
      status: "pending",
    }));

    const { error } = await supabase.from("reminders").insert(rows);
    if (error) {
      console.error("Reminder insert error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to schedule reminders" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { reminders_created: rows.length, schedule },
    });
  } catch (err) {
    console.error("Remind POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
