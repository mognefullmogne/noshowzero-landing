import type { SupabaseClient } from "@supabase/supabase-js";

export async function rescheduleAppointment(
  supabase: SupabaseClient,
  tenantId: string,
  input: Record<string, unknown>
) {
  const appointmentId = input.appointment_id as string;
  const newScheduledAt = input.new_scheduled_at as string;

  // Fetch current appointment
  const { data: current } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!current) return { error: "Appuntamento non trovato" };
  if (current.status === "cancelled" || current.status === "completed" || current.status === "no_show") {
    return { error: `Non e' possibile riprogrammare un appuntamento con stato: ${current.status}` };
  }

  // Cancel old appointment
  const { error: cancelError } = await supabase
    .from("appointments")
    .update({ status: "cancelled", notes: `Riprogrammato a ${newScheduledAt}` })
    .eq("id", appointmentId);

  if (cancelError) return { error: `Errore cancellazione: ${cancelError.message}` };

  // Create new appointment
  const { data: newAppt, error: createError } = await supabase
    .from("appointments")
    .insert({
      tenant_id: tenantId,
      patient_id: current.patient_id,
      service_code: current.service_code,
      service_name: current.service_name,
      provider_name: current.provider_name,
      location_name: current.location_name,
      scheduled_at: newScheduledAt,
      duration_min: current.duration_min,
      payment_category: current.payment_category,
      notes: `Riprogrammato da ${appointmentId}`,
    })
    .select("id, scheduled_at, status")
    .single();

  if (createError) return { error: `Errore creazione: ${createError.message}` };

  return {
    success: true,
    old_appointment_id: appointmentId,
    new_appointment: newAppt,
  };
}
