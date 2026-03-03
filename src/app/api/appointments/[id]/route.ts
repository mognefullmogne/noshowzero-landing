import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { UpdateAppointmentSchema } from "@/lib/validations";
import { VALID_TRANSITIONS, type AppointmentStatus } from "@/lib/types";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid appointment ID" } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const [appointmentRes, offersRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, patient:patients(*), reminders(*)")
        .eq("id", id)
        .eq("tenant_id", auth.data.tenantId)
        .maybeSingle(),
      supabase
        .from("waitlist_offers")
        .select("id, status, smart_score, offered_at, responded_at, patient:patients(first_name, last_name)")
        .eq("original_appointment_id", id)
        .eq("tenant_id", auth.data.tenantId)
        .order("offered_at", { ascending: false }),
    ]);

    if (appointmentRes.error || !appointmentRes.data) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    const data = {
      ...appointmentRes.data,
      offers: offersRes.data ?? [],
    };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Appointment GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid appointment ID" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = UpdateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch current appointment
    const { data: current } = await supabase
      .from("appointments")
      .select("status")
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .maybeSingle();

    if (!current) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

    // Validate status transition
    const currentStatus = current.status as AppointmentStatus;
    const newStatus = parsed.data.status;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowed.join(", ") || "none (terminal state)"}`,
          },
        },
        { status: 422 }
      );
    }

    // Build update data with timestamp fields
    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "confirmed") updateData.confirmed_at = new Date().toISOString();
    if (newStatus === "declined") updateData.declined_at = new Date().toISOString();
    if (newStatus === "reminder_sent") updateData.confirmation_sent_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .select("*, patient:patients(*)")
      .single();

    if (error) {
      console.error("Appointment PATCH error:", error);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to update appointment" } },
        { status: 500 }
      );
    }

    // Trigger waitlist backfill on cancellation or no-show (non-blocking)
    if (newStatus === "cancelled" || newStatus === "no_show") {
      createServiceClient()
        .then((serviceClient) => triggerBackfill(serviceClient, id, auth.data.tenantId))
        .catch((err) => console.error("[Backfill] Trigger failed:", err));
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("Appointment PATCH error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
