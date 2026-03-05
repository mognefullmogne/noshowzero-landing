// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * POST /api/ai/chat — Operator AI chat with tool-use.
 * Accepts { message, history, context? } and returns AI response with tool call details.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { AiChatSchema } from "@/lib/validations";
import { runOperatorChat } from "@/lib/ai/operator-chat";

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

  try {
    const supabase = await createServiceClient();
    const result = await runOperatorChat(
      supabase,
      auth.data.tenantId,
      parsed.data.message,
      parsed.data.history
    );

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[AI Chat] Error:", err);
    return NextResponse.json(
      { success: false, error: { code: "AI_ERROR", message: "AI processing failed" } },
      { status: 500 }
    );
  }
}
