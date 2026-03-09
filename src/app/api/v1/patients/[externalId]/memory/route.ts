// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-key-auth";

interface MemoryFact {
  readonly preferredTimes?: string[];
  readonly preferredDays?: string[];
  readonly preferredProvider?: string;
  readonly language?: string;
  readonly communicationStyle?: string;
  readonly notes?: string[];
}

interface PatientMemory {
  readonly facts: readonly MemoryFact[];
  readonly updatedAt: string;
}

interface ResponsePatterns {
  readonly memory?: PatientMemory;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ externalId: string }> }
) {
  try {
    const auth = await authenticateApiKey(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    const { externalId } = await params;
    const supabase = await createServiceClient();

    const { data: patient, error } = await supabase
      .from("patients")
      .select("id, response_patterns")
      .eq("tenant_id", auth.tenantId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (error || !patient) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Patient not found" } },
        { status: 404 }
      );
    }

    const patterns = (patient.response_patterns ?? {}) as ResponsePatterns;
    const memory = patterns.memory;
    const facts = memory?.facts ?? [];

    // Merge all facts into a consolidated preferences view (latest wins)
    const merged = {
      preferred_times: null as string[] | null,
      preferred_days: null as string[] | null,
      preferred_provider: null as string | null,
      communication_style: null as string | null,
      language: null as string | null,
      notes: [] as string[],
    };

    for (const fact of facts) {
      if (fact.preferredTimes && !merged.preferred_times) merged.preferred_times = [...fact.preferredTimes];
      if (fact.preferredDays && !merged.preferred_days) merged.preferred_days = [...fact.preferredDays];
      if (fact.preferredProvider && !merged.preferred_provider) merged.preferred_provider = fact.preferredProvider;
      if (fact.communicationStyle && !merged.communication_style) merged.communication_style = fact.communicationStyle;
      if (fact.language && !merged.language) merged.language = fact.language;
      if (fact.notes) merged.notes = [...new Set([...merged.notes, ...fact.notes])];
    }

    return NextResponse.json({
      success: true,
      data: {
        preferences: {
          preferred_times: merged.preferred_times,
          preferred_days: merged.preferred_days,
          preferred_provider: merged.preferred_provider,
          communication_style: merged.communication_style,
          language: merged.language,
          notes: merged.notes.length > 0 ? merged.notes : null,
        },
        extracted_from_conversations: facts.length,
        last_updated: memory?.updatedAt ?? null,
      },
    });
  } catch (err) {
    console.error("v1 patient memory GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
