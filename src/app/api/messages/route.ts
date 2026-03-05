// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * GET /api/messages — List message threads with latest message preview, paginated.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { tenantId } = auth.data;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  const supabase = await createClient();

  // Get total count
  const { count } = await supabase
    .from("message_threads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const total = count ?? 0;

  // Get threads with patient info
  const { data: threads, error } = await supabase
    .from("message_threads")
    .select("*, patient:patients(id, first_name, last_name, phone, email)")
    .eq("tenant_id", tenantId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: error.message } },
      { status: 500 }
    );
  }

  // Fetch latest message for each thread
  const threadIds = (threads ?? []).map((t) => t.id);
  let latestMessages: Record<string, unknown> = {};

  if (threadIds.length > 0) {
    // Get the most recent message per thread using a single query
    const { data: messages } = await supabase
      .from("message_events")
      .select("id, thread_id, direction, body, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });

    // Group by thread_id, take first (most recent) for each
    const seen = new Set<string>();
    for (const msg of messages ?? []) {
      if (!seen.has(msg.thread_id)) {
        seen.add(msg.thread_id);
        latestMessages[msg.thread_id] = msg;
      }
    }
  }

  const enrichedThreads = (threads ?? []).map((t) => ({
    ...t,
    latest_message: latestMessages[t.id] ?? null,
  }));

  return NextResponse.json({
    success: true,
    data: enrichedThreads,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
