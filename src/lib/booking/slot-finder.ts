// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Find available appointment slots for a given date.
 * Returns up to 3 slots ordered by start time.
 * Falls back to the next 3 days if no slots on the requested date.
 *
 * Also provides annotated slots with historical attendance data
 * via findAvailableSlotsAnnotated().
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProposedSlotOption } from "./types";
import { annotateSlots, type SlotRiskLabel } from "@/lib/intelligence/slot-recommendations";

const MAX_SLOTS = 3;
const FALLBACK_DAYS = 3;

/**
 * Find available slots for a tenant on a specific date.
 * If no slots found on the exact date, tries the next few days.
 */
export async function findAvailableSlots(
  supabase: SupabaseClient,
  tenantId: string,
  date: string,
  serviceName?: string
): Promise<readonly ProposedSlotOption[]> {
  // Try exact date first
  const exactSlots = await querySlots(supabase, tenantId, date, date, serviceName);
  if (exactSlots.length > 0) return exactSlots;

  // Fallback: try the next FALLBACK_DAYS days
  for (let i = 1; i <= FALLBACK_DAYS; i++) {
    const nextDate = addDays(date, i);
    const fallbackSlots = await querySlots(supabase, tenantId, nextDate, nextDate, serviceName);
    if (fallbackSlots.length > 0) return fallbackSlots;
  }

  return [];
}

/** Extended slot with historical attendance annotation. */
export interface AnnotatedProposedSlot extends ProposedSlotOption {
  readonly riskLabel: SlotRiskLabel;
  readonly attendanceRate: number;
}

/**
 * Find available slots and annotate them with historical attendance data.
 * Returns the same slots as findAvailableSlots, enriched with risk labels.
 */
export async function findAvailableSlotsAnnotated(
  supabase: SupabaseClient,
  tenantId: string,
  date: string,
  serviceName?: string
): Promise<readonly AnnotatedProposedSlot[]> {
  const slots = await findAvailableSlots(supabase, tenantId, date, serviceName);
  if (slots.length === 0) return [];

  const annotated = await annotateSlots(supabase, tenantId, slots);
  return annotated.map((a, idx) => ({
    index: idx + 1,
    slotId: a.slotId,
    startAt: a.startAt,
    endAt: a.endAt,
    providerName: a.providerName,
    riskLabel: a.riskLabel,
    attendanceRate: a.attendanceRate,
  }));
}

async function querySlots(
  supabase: SupabaseClient,
  tenantId: string,
  dateFrom: string,
  dateTo: string,
  serviceName?: string
): Promise<readonly ProposedSlotOption[]> {
  const startOfDay = `${dateFrom}T00:00:00`;
  const endOfDay = `${dateTo}T23:59:59`;

  let query = supabase
    .from("appointment_slots")
    .select("id, start_at, end_at, provider_name, service_code")
    .eq("tenant_id", tenantId)
    .eq("status", "available")
    .gte("start_at", startOfDay)
    .lte("start_at", endOfDay)
    .gt("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(MAX_SLOTS);

  // Fuzzy match on service_code if provided
  if (serviceName) {
    query = query.ilike("service_code", `%${sanitizeForLike(serviceName)}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[SlotFinder] querySlots error:", error);
    return [];
  }

  if (!data || data.length === 0) {
    // If no match with service filter, try without it
    if (serviceName) {
      return querySlots(supabase, tenantId, dateFrom, dateTo);
    }
    return [];
  }

  return data.map((slot, idx) => ({
    index: idx + 1,
    slotId: slot.id,
    startAt: slot.start_at,
    endAt: slot.end_at,
    providerName: slot.provider_name ?? "Medico",
  }));
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/** Escape special SQL LIKE characters to prevent injection via serviceName. */
function sanitizeForLike(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}
