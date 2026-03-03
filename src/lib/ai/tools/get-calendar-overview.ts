import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCalendarOverview(
  supabase: SupabaseClient,
  tenantId: string,
  input: Record<string, unknown>
) {
  const weekStart = input.week_start as string;
  const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("appointments")
    .select("id, service_name, provider_name, scheduled_at, duration_min, status")
    .eq("tenant_id", tenantId)
    .gte("scheduled_at", weekStart)
    .lte("scheduled_at", weekEnd)
    .in("status", ["scheduled", "confirmed", "reminder_sent", "reminder_pending"])
    .order("scheduled_at", { ascending: true });

  if (input.provider_name) {
    query = query.ilike("provider_name", `%${input.provider_name}%`);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  const appointments = data ?? [];

  // Group by day
  const byDay: Record<string, Array<Record<string, unknown>>> = {};
  for (const appt of appointments) {
    const day = new Date(appt.scheduled_at).toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({
      time: new Date(appt.scheduled_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      service: appt.service_name,
      provider: appt.provider_name,
      duration: appt.duration_min,
      status: appt.status,
    });
  }

  // Get slots info
  let slotsQuery = supabase
    .from("appointment_slots")
    .select("id, status, provider_name, start_at")
    .eq("tenant_id", tenantId)
    .gte("start_at", weekStart)
    .lte("start_at", weekEnd);

  if (input.provider_name) {
    slotsQuery = slotsQuery.ilike("provider_name", `%${input.provider_name}%`);
  }

  const { data: slots } = await slotsQuery;
  const totalSlots = (slots ?? []).length;
  const availableSlots = (slots ?? []).filter((s) => s.status === "available").length;
  const bookedSlots = (slots ?? []).filter((s) => s.status === "booked").length;

  return {
    week: { start: weekStart, end: weekEnd },
    total_appointments: appointments.length,
    slot_utilization: {
      total: totalSlots,
      available: availableSlots,
      booked: bookedSlots,
      utilization_rate: totalSlots > 0 ? ((bookedSlots / totalSlots) * 100).toFixed(1) + "%" : "N/A",
    },
    daily_breakdown: byDay,
  };
}
