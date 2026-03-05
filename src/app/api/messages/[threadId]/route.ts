// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET  /api/messages/[threadId] — Messages in thread, ordered by created_at ASC.
 * POST /api/messages/[threadId] — Send outbound message to patient.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { SendMessageSchema } from "@/lib/validations";
import { sendMessage } from "@/lib/messaging/send-message";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { tenantId } = auth.data;
  const { threadId } = await params;
  const supabase = await createClient();

  // Verify thread belongs to tenant
  const { data: thread } = await supabase
    .from("message_threads")
    .select("*, patient:patients(id, first_name, last_name, phone, email, preferred_channel)")
    .eq("id", threadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!thread) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Thread not found" } },
      { status: 404 }
    );
  }

  // Get messages
  const { data: messages, error } = await supabase
    .from("message_events")
    .select("*")
    .eq("thread_id", threadId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { thread, messages: messages ?? [] },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { tenantId } = auth.data;
  const { threadId } = await params;

  const body = await request.json();
  const parsed = SendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Verify thread and get patient
  const { data: thread } = await supabase
    .from("message_threads")
    .select("*, patient:patients(id, phone, preferred_channel)")
    .eq("id", threadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!thread) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Thread not found" } },
      { status: 404 }
    );
  }

  const patient = thread.patient;
  if (!patient?.phone) {
    return NextResponse.json(
      { success: false, error: { code: "NO_PHONE", message: "Patient has no phone number" } },
      { status: 400 }
    );
  }

  const serviceClient = await createServiceClient();
  const channel = parsed.data.channel ?? thread.channel;

  const result = await sendMessage(serviceClient, {
    tenantId,
    patientId: patient.id,
    patientPhone: patient.phone,
    channel,
    body: parsed.data.body,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: { code: "SEND_FAILED", message: result.error ?? "Failed to send message" } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: result.message }, { status: 201 });
}
