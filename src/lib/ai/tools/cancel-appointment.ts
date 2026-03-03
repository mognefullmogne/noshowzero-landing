import type { SupabaseClient } from "@supabase/supabase-js";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";

export async function cancelAppointment(
  supabase: SupabaseClient,
  tenantId: string,
  input: Record<string, unknown>
) {
  const appointmentId = input.appointment_id as string;
  const reason = (input.reason as string) ?? "Cancellato dall'operatore via AI";

  const { data, error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      notes: reason,
      declined_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .in("status", ["scheduled", "reminder_pending", "reminder_sent", "confirmed"])
    .select("id, status")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Appuntamento non trovato o non cancellabile" };

  // Trigger backfill
  try {
    await triggerBackfill(supabase, appointmentId, tenantId);
  } catch (err) {
    console.error("[AI] Backfill trigger failed:", err);
  }

  return { success: true, appointment_id: data.id, status: "cancelled" };
}
