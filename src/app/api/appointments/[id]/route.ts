import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { UpdateAppointmentSchema } from "@/lib/validations";
import { VALID_TRANSITIONS, type AppointmentStatus } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedTenant();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("appointments")
      .select("*, patient:patients(*), reminders(*)")
      .eq("id", id)
      .eq("tenant_id", auth.data.tenantId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Appointment not found" } },
        { status: 404 }
      );
    }

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

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("Appointment PATCH error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
