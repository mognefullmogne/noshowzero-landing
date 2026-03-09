// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { PublicSendMessageSchema } from "@/lib/validations";
import { sendNotification } from "@/lib/twilio/send-notification";

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = PublicSendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      );
    }

    const supabase = await createServiceClient();

    // Look up patient by external_id
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, phone, email, preferred_channel")
      .eq("tenant_id", auth.tenantId)
      .eq("external_id", parsed.data.patient_external_id)
      .maybeSingle();

    if (patientError) {
      console.error("v1 messages send: patient lookup error:", patientError);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to look up patient" } },
        { status: 500 },
      );
    }

    if (!patient) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Patient not found with given external_id" } },
        { status: 404 },
      );
    }

    const channel = parsed.data.channel ?? patient.preferred_channel ?? "whatsapp";
    const to = channel === "email" ? patient.email : patient.phone;

    if (!to) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: `Patient has no ${channel === "email" ? "email" : "phone"} on file` } },
        { status: 400 },
      );
    }

    const result = await sendNotification({
      to,
      body: parsed.data.message,
      channel,
      tenantId: auth.tenantId,
    });

    return NextResponse.json({
      success: true,
      data: {
        message_sid: result.externalMessageId,
        channel,
        status: result.status,
      },
    }, { status: result.status === "sent" ? 200 : 502 });
  } catch (err) {
    console.error("v1 messages send POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}
