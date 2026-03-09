// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { PublicChatMessageSchema } from "@/lib/validations";
import { runOperatorChat } from "@/lib/ai/operator-chat";

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = PublicChatMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const result = await runOperatorChat(
      supabase,
      auth.tenantId,
      parsed.data.message,
      parsed.data.history ?? []
    );

    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        tool_calls: result.tool_calls,
        tokens_used: result.tokens_used,
      },
    });
  } catch (err) {
    console.error("v1 chat POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
