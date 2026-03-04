/**
 * Process offer responses: Accept creates a new appointment, Decline cascades to next candidate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureRemindersScheduled } from "@/lib/reminders/schedule-reminders";
import { triggerBackfill } from "./trigger-backfill";

/**
 * Accept flow:
 * 1. Guard: offer must be pending + not expired + slot in future
 * 2. Atomically claim the offer (WHERE status = 'pending')
 * 3. Create new appointment (same slot details)
 * 4. Update offer → link new appointment
 * 5. Cancel any other pending offers for the same original appointment
 * 6. Free the candidate's original appointment (chain cascade trigger)
 * 7. Schedule reminders for the new appointment
 */
export async function processAccept(
  supabase: SupabaseClient,
  offerId: string
): Promise<{ success: boolean; newAppointmentId?: string; freedAppointmentId?: string; error?: string }> {
  // Atomically claim the offer (WHERE status = 'pending' prevents double-acceptance)
  const { data: offer, error: claimError } = await supabase
    .from("waitlist_offers")
    .update({
      status: "accepted",
      responded_at: new Date().toISOString(),
    })
    .eq("id", offerId)
    .eq("status", "pending")
    .select("*, original_appointment:appointments!waitlist_offers_original_appointment_id_fkey(*), patient:patients!waitlist_offers_patient_id_fkey(preferred_channel)")
    .single();

  if (claimError || !offer) {
    return { success: false, error: "Offer is no longer available (already accepted, declined, or expired)" };
  }

  // Check if offer has expired (DB-level check, not just token-level)
  if (new Date(offer.expires_at) < new Date()) {
    await supabase
      .from("waitlist_offers")
      .update({ status: "expired" })
      .eq("id", offerId);
    return { success: false, error: "This offer has expired" };
  }

  const originalAppt = offer.original_appointment;
  if (!originalAppt) {
    return { success: false, error: "Original appointment not found" };
  }

  // Verify slot is still in the future
  if (new Date(originalAppt.scheduled_at) <= new Date()) {
    await supabase
      .from("waitlist_offers")
      .update({ status: "expired" })
      .eq("id", offerId);
    return { success: false, error: "This slot has already passed" };
  }

  // Create replacement appointment
  const { data: newAppt, error: apptError } = await supabase
    .from("appointments")
    .insert({
      tenant_id: offer.tenant_id,
      patient_id: offer.patient_id,
      service_code: originalAppt.service_code,
      service_name: originalAppt.service_name,
      provider_name: originalAppt.provider_name,
      location_name: originalAppt.location_name,
      scheduled_at: originalAppt.scheduled_at,
      duration_min: originalAppt.duration_min,
      payment_category: originalAppt.payment_category,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      notes: `Waitlist backfill: replaced cancelled appointment ${originalAppt.id}`,
    })
    .select("id")
    .single();

  if (apptError || !newAppt) {
    console.error("[Backfill] Failed to create replacement appointment:", apptError);
    // Do NOT rollback offer to pending — it's been claimed. Mark as cancelled instead
    // to prevent race condition where another request could claim it.
    await supabase
      .from("waitlist_offers")
      .update({ status: "cancelled" })
      .eq("id", offerId);
    return { success: false, error: "Failed to create appointment — please contact support" };
  }

  // Link new appointment to offer
  await supabase
    .from("waitlist_offers")
    .update({ new_appointment_id: newAppt.id })
    .eq("id", offerId);

  // Cancel any other pending offers for the same original appointment
  await supabase
    .from("waitlist_offers")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("original_appointment_id", offer.original_appointment_id)
    .eq("status", "pending")
    .neq("id", offerId);

  // Free the candidate's original appointment (they moved to the earlier slot)
  const candidateApptId: string | null = offer.candidate_appointment_id ?? null;
  if (candidateApptId) {
    await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        declined_at: new Date().toISOString(),
        notes: `Freed by slot recovery — patient moved to earlier slot ${offer.original_appointment_id}`,
      })
      .eq("id", candidateApptId)
      .eq("tenant_id", offer.tenant_id)
      .in("status", ["scheduled", "reminder_pending", "reminder_sent", "confirmed"]);

    // Chain cascade: the freed slot is now available for another patient
    // Fire-and-forget — don't block the accept response
    triggerBackfill(supabase, candidateApptId, offer.tenant_id)
      .catch((err) => console.error("[Backfill] Chain cascade failed:", err));
  }

  // Use patient's actual preferred channel for reminders
  const patientData = offer.patient as unknown as { preferred_channel?: string } | null;
  const preferredChannel = (patientData?.preferred_channel ?? "sms") as "email" | "sms" | "whatsapp";

  // Schedule reminders for the new appointment
  await ensureRemindersScheduled(supabase, {
    appointmentId: newAppt.id,
    tenantId: offer.tenant_id,
    scheduledAt: new Date(originalAppt.scheduled_at),
    riskScore: 10, // Low risk — they actively accepted
    preferredChannel,
  });

  return {
    success: true,
    newAppointmentId: newAppt.id,
    freedAppointmentId: candidateApptId ?? undefined,
  };
}

/**
 * Decline flow:
 * 1. Update offer → declined
 * 2. Trigger backfill again → finds next best candidate
 */
export async function processDecline(
  supabase: SupabaseClient,
  offerId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: offer, error: claimError } = await supabase
    .from("waitlist_offers")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("id", offerId)
    .eq("status", "pending")
    .select("*, original_appointment:appointments!waitlist_offers_original_appointment_id_fkey(*)")
    .single();

  if (claimError || !offer) {
    return { success: false, error: "Offer is no longer available" };
  }

  // Cascade: try next candidate for the same slot
  const originalAppt = offer.original_appointment;
  if (originalAppt && new Date(originalAppt.scheduled_at) > new Date()) {
    await triggerBackfill(supabase, originalAppt.id, offer.tenant_id);
  }

  return { success: true };
}
