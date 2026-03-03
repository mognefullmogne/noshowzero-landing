import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureRemindersScheduled } from "@/lib/reminders/schedule-reminders";

/**
 * Daily cron job to:
 * 1. Process pending reminders that are due (mark as sent)
 * 2. Safety-net: schedule reminders for appointments in the next 72h that have none
 *
 * Protected by CRON_SECRET env var.
 */
export async function GET(request: Request) {
  // Verify cron secret — fail closed if not configured
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set — refusing to run cron endpoint");
    return NextResponse.json({ error: "Service misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createServiceClient();
    const now = new Date();
    let processed = 0;
    let scheduled = 0;

    // 1. Mark due reminders as "sent"
    const { data: dueReminders } = await supabase
      .from("reminders")
      .select("id")
      .eq("status", "pending")
      .lte("scheduled_at", now.toISOString())
      .limit(100);

    if (dueReminders && dueReminders.length > 0) {
      const ids = dueReminders.map((r) => r.id);
      await supabase
        .from("reminders")
        .update({ status: "sent", sent_at: now.toISOString() })
        .in("id", ids);
      processed = ids.length;
    }

    // 2. Safety net — find appointments in next 72h without pending reminders
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
        const patientData = appt.patient as unknown as { preferred_channel?: string } | null;
        const channel = (patientData?.preferred_channel ?? "email") as "email" | "sms" | "whatsapp";
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
      data: { processed, scheduled, timestamp: now.toISOString() },
    });
  } catch (err) {
    console.error("Cron process-reminders error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
