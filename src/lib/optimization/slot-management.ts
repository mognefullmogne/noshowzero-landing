// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Slot management — CRUD and weekly slot generation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface GenerateParams {
  readonly tenantId: string;
  readonly providerName: string;
  readonly locationName?: string;
  readonly serviceCode?: string;
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string;
  readonly slotDurationMin: number;
  readonly dayStartHour: number;
  readonly dayEndHour: number;
  readonly excludeWeekends: boolean;
}

export async function generateWeeklySlots(
  supabase: SupabaseClient,
  params: GenerateParams
): Promise<{ created: number; error?: string }> {
  const slots: Array<Record<string, unknown>> = [];
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();

    // Skip weekends if configured
    if (params.excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      continue;
    }

    // Generate slots for each time block in the day
    for (let hour = params.dayStartHour; hour < params.dayEndHour; ) {
      const slotStart = new Date(d);
      slotStart.setHours(hour, 0, 0, 0);

      const slotEnd = new Date(slotStart.getTime() + params.slotDurationMin * 60 * 1000);

      // Don't exceed day end
      const dayEnd = new Date(d);
      dayEnd.setHours(params.dayEndHour, 0, 0, 0);
      if (slotEnd > dayEnd) break;

      slots.push({
        tenant_id: params.tenantId,
        provider_name: params.providerName,
        location_name: params.locationName ?? null,
        service_code: params.serviceCode ?? null,
        start_at: slotStart.toISOString(),
        end_at: slotEnd.toISOString(),
        status: "available",
      });

      hour = slotEnd.getHours() + (slotEnd.getMinutes() > 0 ? 1 : 0);
      // More precise: advance by slot duration in minutes
      const nextMinutes = hour * 60;
      const slotMinutes = slotStart.getHours() * 60 + params.slotDurationMin;
      if (slotMinutes > nextMinutes) {
        // Slot doesn't align to hour boundary
      }
      // Simple approach: advance by duration
      const nextStart = new Date(slotStart.getTime() + params.slotDurationMin * 60 * 1000);
      hour = nextStart.getHours();
      if (nextStart.getMinutes() > 0) {
        // Use exact minute calculation
      }
      break; // Fix: use proper loop below
    }
  }

  // Re-generate with proper loop
  const properSlots: Array<Record<string, unknown>> = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (params.excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) continue;

    const dayStart = new Date(d);
    dayStart.setHours(params.dayStartHour, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(params.dayEndHour, 0, 0, 0);

    let current = dayStart.getTime();
    while (current + params.slotDurationMin * 60 * 1000 <= dayEnd.getTime()) {
      const slotStart = new Date(current);
      const slotEnd = new Date(current + params.slotDurationMin * 60 * 1000);

      properSlots.push({
        tenant_id: params.tenantId,
        provider_name: params.providerName,
        location_name: params.locationName ?? null,
        service_code: params.serviceCode ?? null,
        start_at: slotStart.toISOString(),
        end_at: slotEnd.toISOString(),
        status: "available",
      });

      current = slotEnd.getTime();
    }
  }

  if (properSlots.length === 0) {
    return { created: 0 };
  }

  // Batch insert (Supabase limit ~1000 rows per insert)
  const BATCH_SIZE = 500;
  let created = 0;
  for (let i = 0; i < properSlots.length; i += BATCH_SIZE) {
    const batch = properSlots.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("appointment_slots").insert(batch);
    if (error) {
      return { created, error: error.message };
    }
    created += batch.length;
  }

  return { created };
}
