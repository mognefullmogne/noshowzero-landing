/**
 * Create an offer record, generate HMAC tokens, send notification via Twilio,
 * and update the waitlist entry status to offer_pending.
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RankedCandidate } from "./find-candidates";
import { generateOfferToken } from "./offer-tokens";
import { sendNotification } from "@/lib/twilio/send-notification";
import {
  renderOfferWhatsApp,
  renderOfferSms,
  renderOfferEmailSubject,
  renderOfferEmailBody,
} from "@/lib/twilio/templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface SendOfferInput {
  readonly candidate: RankedCandidate;
  readonly originalAppointmentId: string;
  readonly tenantId: string;
  readonly serviceName: string;
  readonly providerName: string | null;
  readonly locationName: string | null;
  readonly scheduledAt: Date;
}

export interface SendOfferResult {
  readonly offerId: string;
  readonly status: "sent" | "failed";
  readonly errorMessage?: string;
}

export async function sendOffer(
  supabase: SupabaseClient,
  input: SendOfferInput
): Promise<SendOfferResult> {
  // Pre-generate UUID so we can create tokens before the insert
  const offerId = randomUUID();
  const acceptToken = generateOfferToken(offerId, "accept");
  const declineToken = generateOfferToken(offerId, "decline");

  // Single atomic insert with the real token hash
  const { error: insertError } = await supabase
    .from("waitlist_offers")
    .insert({
      id: offerId,
      tenant_id: input.tenantId,
      original_appointment_id: input.originalAppointmentId,
      waitlist_entry_id: input.candidate.waitlistEntryId,
      patient_id: input.candidate.patientId,
      status: "pending",
      smart_score: input.candidate.smartScore.total,
      smart_score_breakdown: input.candidate.smartScore,
      token_hash: acceptToken.tokenHash,
      expires_at: acceptToken.expiresAt.toISOString(),
    });

  if (insertError) {
    console.error("[Backfill] Failed to create offer:", insertError);
    return { offerId: "", status: "failed", errorMessage: insertError.message };
  }

  // Build notification URLs
  const acceptUrl = `${APP_URL}/api/offers/${offerId}/accept?token=${encodeURIComponent(acceptToken.token)}`;
  const declineUrl = `${APP_URL}/api/offers/${offerId}/decline?token=${encodeURIComponent(declineToken.token)}`;
  const statusUrl = `${APP_URL}/api/offers/${offerId}?token=${encodeURIComponent(acceptToken.token)}`;

  // Format date/time
  const dateStr = input.scheduledAt.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = input.scheduledAt.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const expiresStr = acceptToken.expiresAt.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const templateVars = {
    patient_name: input.candidate.patientName,
    service_name: input.serviceName,
    date: dateStr,
    time: timeStr,
    provider_name: input.providerName ?? undefined,
    location_name: input.locationName ?? undefined,
    accept_url: acceptUrl,
    decline_url: declineUrl,
    status_url: statusUrl,
    expires_at: expiresStr,
  };

  // Determine channel, message content, and recipient
  const channel = input.candidate.preferredChannel;
  let body: string;
  let subject: string | undefined;
  let to: string;

  if (channel === "whatsapp") {
    body = renderOfferWhatsApp(templateVars);
    to = input.candidate.patientPhone ?? "";
  } else if (channel === "sms") {
    body = renderOfferSms(templateVars);
    to = input.candidate.patientPhone ?? "";
  } else {
    // Email channel: use SMS as delivery mechanism with concise body
    // until proper email integration (Twilio SendGrid) is configured
    body = renderOfferSms(templateVars);
    to = input.candidate.patientPhone ?? "";
    subject = renderOfferEmailSubject(templateVars);
  }

  if (!to) {
    console.error("[Backfill] No contact info for patient");
    await supabase
      .from("waitlist_offers")
      .update({ status: "cancelled", responded_at: new Date().toISOString() })
      .eq("id", offerId);
    return { offerId, status: "failed", errorMessage: "No contact info" };
  }

  // Send notification (uses SMS template for email-preferred patients until SendGrid is set up)
  const effectiveChannel = channel === "email" ? "sms" : channel;
  const sendResult = await sendNotification({ to, body, channel: effectiveChannel, subject });

  if (sendResult.status === "failed") {
    console.error("[Backfill] Failed to send notification:", sendResult.errorMessage);
    await supabase
      .from("waitlist_offers")
      .update({ status: "cancelled", responded_at: new Date().toISOString() })
      .eq("id", offerId);
    return { offerId, status: "failed", errorMessage: sendResult.errorMessage };
  }

  // Create message thread + event for offer tracking (enables patient reply routing)
  const { data: existingThread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("patient_id", input.candidate.patientId)
    .eq("channel", effectiveChannel)
    .maybeSingle();

  let offerThreadId: string | null = null;
  if (existingThread) {
    offerThreadId = existingThread.id;
  } else {
    const { data: newThread } = await supabase
      .from("message_threads")
      .insert({
        tenant_id: input.tenantId,
        patient_id: input.candidate.patientId,
        channel: effectiveChannel,
      })
      .select("id")
      .single();
    offerThreadId = newThread?.id ?? null;
  }

  if (offerThreadId) {
    await supabase.from("message_events").insert({
      tenant_id: input.tenantId,
      thread_id: offerThreadId,
      direction: "outbound",
      channel: effectiveChannel,
      body,
      from_number: null,
      to_number: to,
      external_sid: sendResult.externalMessageId || null,
      context_offer_id: offerId,
    });
    await supabase
      .from("message_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", offerThreadId);
  }

  // Atomic increment of offers_sent using RPC-style pattern
  // Supabase doesn't support raw SQL expressions in .update(), so we use a select + update
  // with the value computed at query time to minimize race window
  const { data: entry } = await supabase
    .from("waitlist_entries")
    .select("offers_sent")
    .eq("id", input.candidate.waitlistEntryId)
    .single();

  const newCount = (entry?.offers_sent ?? 0) + 1;
  const { error: updateError } = await supabase
    .from("waitlist_entries")
    .update({ status: "offer_pending", offers_sent: newCount })
    .eq("id", input.candidate.waitlistEntryId)
    .eq("offers_sent", entry?.offers_sent ?? 0); // CAS guard: only update if count hasn't changed

  if (updateError) {
    console.error("[Backfill] Failed to update waitlist entry:", updateError);
  }

  return { offerId, status: "sent" };
}
