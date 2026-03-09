// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { PublicClassifyMessageSchema } from "@/lib/validations";
import { classifyIntent } from "@/lib/messaging/intent-engine";

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
    const parsed = PublicClassifyMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      );
    }

    const result = classifyIntent(parsed.data.message);

    return NextResponse.json({
      success: true,
      data: {
        intent: result.intent,
        confidence: result.confidence,
        source: result.source,
      },
    });
  } catch (err) {
    console.error("v1 messages classify POST error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}
