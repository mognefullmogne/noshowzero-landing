// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Sync engine: orchestrates fetching + importing for each integration type.
 * Used by manual sync, cron, and post-connection initial sync.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarIntegration, ImportResult } from "./types";
import { importCalendarEvents } from "./appointment-importer";
import { fetchGoogleEvents } from "./google-calendar";
import { fetchOutlookEvents } from "./outlook-calendar";
import { parseICalFeed } from "./ical-parser";
import { ensureValidGoogleToken } from "./token-refresh";
import { ensureValidOutlookToken } from "./token-refresh";
import { maybeProcessPending } from "@/lib/engine/process-pending";

/**
 * Run a full sync for one integration. Returns import stats.
 */
export async function syncIntegration(
  supabase: SupabaseClient,
  integration: CalendarIntegration
): Promise<ImportResult> {
  // Create running import log
  const { data: importLog } = await supabase
    .from("import_logs")
    .insert({
      tenant_id: integration.tenant_id,
      integration_id: integration.id,
      provider: integration.provider,
      status: "running",
    })
    .select("id")
    .single();

  try {
    let result: ImportResult;

    switch (integration.provider) {
      case "google":
        result = await syncGoogle(supabase, integration);
        break;
      case "outlook":
        result = await syncOutlook(supabase, integration);
        break;
      case "ical":
        result = await syncICal(supabase, integration);
        break;
      default:
        throw new Error(`Unsupported sync provider: ${integration.provider}`);
    }

    // Update integration status
    await supabase
      .from("calendar_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        status: "active",
        error_message: null,
      })
      .eq("id", integration.id);

    // Wake up the AI engine to evaluate newly imported/cancelled appointments
    if (result.imported > 0) {
      maybeProcessPending(supabase, integration.tenant_id);
    }

    // Complete import log
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

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";

    // Mark integration as error
    await supabase
      .from("calendar_integrations")
      .update({ status: "error", error_message: message })
      .eq("id", integration.id);

    // Fail import log
    if (importLog) {
      await supabase
        .from("import_logs")
        .update({
          status: "failed",
          error_details: [{ eventSummary: integration.provider, reason: message }],
          completed_at: new Date().toISOString(),
        })
        .eq("id", importLog.id);
    }

    throw err;
  }
}

/**
 * Sync all active integrations for a tenant.
 */
export async function syncAllActiveIntegrations(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  const { data: integrations } = await supabase
    .from("calendar_integrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .neq("provider", "csv"); // CSV doesn't sync

  if (!integrations?.length) return;

  for (const integration of integrations) {
    try {
      await syncIntegration(supabase, integration);
    } catch (err) {
      console.error(`[SyncEngine] Failed to sync ${integration.provider} for tenant ${tenantId}:`, err);
    }
  }
}

// -- Provider-specific sync functions --

async function syncGoogle(
  supabase: SupabaseClient,
  integration: CalendarIntegration
): Promise<ImportResult> {
  const accessToken = await ensureValidGoogleToken(supabase, integration);
  const calendarIds = (integration.calendar_ids ?? []) as string[];
  const syncToken = integration.sync_token ?? undefined;

  if (calendarIds.length === 0) {
    // Default to primary calendar
    calendarIds.push("primary");
  }

  let totalResult: ImportResult = {
    total: 0, imported: 0, skipped: 0, failed: 0, errors: [],
  };

  for (const calId of calendarIds) {
    const { events, nextSyncToken } = await fetchGoogleEvents(
      accessToken,
      calId,
      syncToken
    );

    const result = await importCalendarEvents(
      supabase,
      integration.tenant_id,
      events
    );

    totalResult = mergeResults(totalResult, result);

    // Store sync token for incremental sync
    if (nextSyncToken) {
      await supabase
        .from("calendar_integrations")
        .update({ sync_token: nextSyncToken })
        .eq("id", integration.id);
    }
  }

  return totalResult;
}

async function syncOutlook(
  supabase: SupabaseClient,
  integration: CalendarIntegration
): Promise<ImportResult> {
  const accessToken = await ensureValidOutlookToken(supabase, integration);
  const calendarIds = (integration.calendar_ids ?? []) as string[];
  const deltaLink = integration.sync_token ?? undefined;

  if (calendarIds.length === 0) {
    return { total: 0, imported: 0, skipped: 0, failed: 0, errors: [] };
  }

  let totalResult: ImportResult = {
    total: 0, imported: 0, skipped: 0, failed: 0, errors: [],
  };

  for (const calId of calendarIds) {
    const { events, nextDeltaLink } = await fetchOutlookEvents(
      accessToken,
      calId,
      deltaLink
    );

    const result = await importCalendarEvents(
      supabase,
      integration.tenant_id,
      events
    );

    totalResult = mergeResults(totalResult, result);

    if (nextDeltaLink) {
      await supabase
        .from("calendar_integrations")
        .update({ sync_token: nextDeltaLink })
        .eq("id", integration.id);
    }
  }

  return totalResult;
}

async function syncICal(
  supabase: SupabaseClient,
  integration: CalendarIntegration
): Promise<ImportResult> {
  if (!integration.ical_url) {
    throw new Error("No iCal URL configured");
  }

  const events = await parseICalFeed(integration.ical_url);
  return importCalendarEvents(supabase, integration.tenant_id, events);
}

function mergeResults(a: ImportResult, b: ImportResult): ImportResult {
  return {
    total: a.total + b.total,
    imported: a.imported + b.imported,
    skipped: a.skipped + b.skipped,
    failed: a.failed + b.failed,
    errors: [...a.errors, ...b.errors],
  };
}
