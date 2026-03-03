import type { SupabaseClient } from "@supabase/supabase-js";

export async function getAppointmentDetails(
  supabase: SupabaseClient,
  tenantId: string,
  appointmentId: string
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("*, patient:patients(*)")
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Appuntamento non trovato" };

  // Get reminders
  const { data: reminders } = await supabase
    .from("reminders")
    .select("channel, message_tone, scheduled_at, status, sent_at")
    .eq("appointment_id", appointmentId)
    .order("scheduled_at", { ascending: true });

  // Get offers
  const { data: offers } = await supabase
    .from("waitlist_offers")
    .select("id, status, smart_score, offered_at, responded_at")
    .eq("original_appointment_id", appointmentId)
    .order("created_at", { ascending: false });

  return {
    appointment: data,
    reminders: reminders ?? [],
    offers: offers ?? [],
  };
}
