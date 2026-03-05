// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * POST /api/ai/appointment-chat — Context-aware AI for appointment detail panel.
 * Accepts { message, history, context: { appointment_id } }.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { AiChatSchema } from "@/lib/validations";
import { runAppointmentChat } from "@/lib/ai/appointment-chat";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const parsed = AiChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const appointmentId = parsed.data.context?.appointment_id;
  if (!appointmentId) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_CONTEXT", message: "appointment_id is required in context" } },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServiceClient();
    const result = await runAppointmentChat(
      supabase,
      auth.data.tenantId,
      appointmentId,
      parsed.data.message,
      parsed.data.history
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[Appointment Chat] Error:", err);
    return NextResponse.json(
      { success: false, error: { code: "AI_ERROR", message: "AI processing failed" } },
      { status: 500 }
    );
  }
}
