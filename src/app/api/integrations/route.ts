/**
 * GET  /api/integrations — List tenant's integrations with recent import logs
 * POST /api/integrations — Create new integration (iCal feed or register CSV)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { parseICalFeed } from "@/lib/integrations/ical-parser";
import { importCalendarEvents } from "@/lib/integrations/appointment-importer";
import { validateICalUrl } from "@/lib/integrations/validate-ical-url";

// Columns safe to return to the client (excludes tokens, sync_token, ical_url)
const SAFE_INTEGRATION_COLUMNS = "id, tenant_id, provider, label, token_expires_at, calendar_ids, last_sync_at, status, error_message, created_at, updated_at";

export async function GET() {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { tenantId } = auth.data;

  const [{ data: integrations }, { data: logs }] = await Promise.all([
    supabase
      .from("calendar_integrations")
      .select(SAFE_INTEGRATION_COLUMNS)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("import_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      integrations: integrations ?? [],
      importLogs: logs ?? [],
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { tenantId } = auth.data;
  const supabase = await createClient();

  let body: {
    provider: string;
    label?: string;
    ical_url?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_BODY", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  if (body.provider !== "ical") {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_PROVIDER", message: "Use POST for iCal feeds. Google/Outlook use OAuth flow. CSV uses /csv/upload." } },
      { status: 400 }
    );
  }

  // iCal feed — validate URL and import
  const icalUrl = body.ical_url?.trim();
  if (!icalUrl) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_URL", message: "ical_url is required for iCal provider" } },
      { status: 400 }
    );
  }

  let validatedUrl: string;
  try {
    validatedUrl = await validateICalUrl(icalUrl);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_URL", message: err instanceof Error ? err.message : "Invalid iCal feed URL" } },
      { status: 400 }
    );
  }

  // Upsert integration
  const { data: integration, error: upsertError } = await supabase
    .from("calendar_integrations")
    .upsert(
      {
        tenant_id: tenantId,
        provider: "ical",
        label: body.label ?? "iCal Feed",
        ical_url: validatedUrl,
        status: "active",
        error_message: null,
      },
      { onConflict: "tenant_id,provider" }
    )
    .select("id")
    .single();

  if (upsertError || !integration) {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: upsertError?.message ?? "Failed to save integration" } },
      { status: 500 }
    );
  }

  // Fetch and import events
  const { data: importLog } = await supabase
    .from("import_logs")
    .insert({
      tenant_id: tenantId,
      integration_id: integration.id,
      provider: "ical",
      status: "running",
    })
    .select("id")
    .single();

  try {
    const events = await parseICalFeed(validatedUrl);
    const result = await importCalendarEvents(supabase, tenantId, events);

    // Update integration
    await supabase
      .from("calendar_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        status: "active",
        error_message: null,
      })
      .eq("id", integration.id);

    // Update import log
    if (importLog) {
      await supabase
        .from("import_logs")
        .update({
          status: result.failed > 0 && result.imported === 0 ? "failed" : "completed",
          total_events: result.total,
          imported: result.imported,
          skipped: result.skipped,
          failed: result.failed,
          error_details: result.errors,
          completed_at: new Date().toISOString(),
        })
        .eq("id", importLog.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        integrationId: integration.id,
        import: result,
      },
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "iCal fetch failed";

    // Mark integration as error
    await supabase
      .from("calendar_integrations")
      .update({ status: "error", error_message: message })
      .eq("id", integration.id);

    if (importLog) {
      await supabase
        .from("import_logs")
        .update({
          status: "failed",
          error_details: [{ eventSummary: "iCal feed", reason: message }],
          completed_at: new Date().toISOString(),
        })
        .eq("id", importLog.id);
    }

    return NextResponse.json(
      { success: false, error: { code: "ICAL_FETCH_ERROR", message } },
      { status: 502 }
    );
  }
}
