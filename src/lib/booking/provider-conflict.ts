/**
 * Check whether a provider already has an active appointment that overlaps
 * with a proposed time window. Prevents double-booking the same person.
 *
 * Two time ranges overlap when: existingStart < newEnd AND existingEnd > newStart
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface ConflictCheck {
  readonly tenantId: string;
  readonly providerName: string | null | undefined;
  readonly scheduledAt: string; // ISO datetime
  readonly durationMin: number;
  /** Exclude this appointment ID (useful when rescheduling). */
  readonly excludeId?: string;
}

interface ConflictResult {
  readonly hasConflict: boolean;
  readonly conflicting?: {
    readonly id: string;
    readonly scheduled_at: string;
    readonly service_name: string;
    readonly duration_min: number;
  };
}

/** Active statuses — appointments in these states occupy the provider's time. */
const ACTIVE_STATUSES = ["scheduled", "reminder_pending", "reminder_sent", "confirmed"];

export async function checkProviderConflict(
  supabase: SupabaseClient,
  check: ConflictCheck
): Promise<ConflictResult> {
  const newStart = new Date(check.scheduledAt);
  const newEnd = new Date(newStart.getTime() + check.durationMin * 60_000);

  let query = supabase
    .from("appointments")
    .select("id, scheduled_at, service_name, duration_min")
    .eq("tenant_id", check.tenantId)
    .in("status", ACTIVE_STATUSES)
    .lt("scheduled_at", newEnd.toISOString()); // existing starts before new ends

  // Filter by provider — if null, check all appointments without a provider
  if (check.providerName) {
    query = query.eq("provider_name", check.providerName);
  } else {
    query = query.is("provider_name", null);
  }

  if (check.excludeId) {
    query = query.neq("id", check.excludeId);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    console.error("[ProviderConflict] Query error:", error);
    // Fail open — don't block creation on query errors
    return { hasConflict: false };
  }

  if (!data || data.length === 0) {
    return { hasConflict: false };
  }

  // Check each existing appointment for time overlap
  for (const existing of data) {
    const existingStart = new Date(existing.scheduled_at);
    const existingEnd = new Date(existingStart.getTime() + existing.duration_min * 60_000);

    // Overlap: existingStart < newEnd AND existingEnd > newStart
    if (existingStart < newEnd && existingEnd > newStart) {
      return {
        hasConflict: true,
        conflicting: {
          id: existing.id,
          scheduled_at: existing.scheduled_at,
          service_name: existing.service_name,
          duration_min: existing.duration_min,
        },
      };
    }
  }

  return { hasConflict: false };
}
