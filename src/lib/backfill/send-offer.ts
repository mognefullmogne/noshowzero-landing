// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Create an offer record, generate HMAC tokens, send notification via Twilio,
 * and update the waitlist entry status to offer_pending.
 *
 * Supports:
 *   - Variable expiry durations (time-aware cascade speed)
 *   - Urgency prefix for critical-time slots
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RankedCandidate } from "./find-candidates";
import { generateOfferToken } from "./offer-tokens";
import { sendNotification } from "@/lib/twilio/send-notification";
import { getOptimalContactTime } from "@/lib/intelligence/response-patterns";
import {
  renderOfferWhatsApp,
  renderOfferSms,
  renderOfferEmailSubject,
  renderOfferEmailBody,
} from "@/lib/twilio/templates";
import { CONTENT_SIDS, buildBackfillOfferVars } from "@/lib/twilio/content-templates";
import { logAuditEvent } from "@/lib/audit/log-event";
import { dispatchWebhookEvent } from "@/lib/webhooks/outbound";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface SendOfferInput {
  readonly candidate: RankedCandidate;
  readonly originalAppointmentId: string;
  readonly tenantId: string;
  readonly serviceName: string;
  readonly providerName: string | null;
  readonly locationName: string | null;
  readonly scheduledAt: Date;
  /** Custom expiry in minutes. Defaults to 60 (standard). */
  readonly expiryMinutes?: number;
  /** Prefix prepended to message body for urgent slots (e.g., "URGENTE"). */
  readonly urgencyPrefix?: string | null;
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
  const effectiveExpiry = input.expiryMinutes ?? 60;
  const acceptToken = generateOfferToken(offerId, "accept", effectiveExpiry);
  const declineToken = generateOfferToken(offerId, "decline", effectiveExpiry);

  // Single atomic insert with the real token hash
  // waitlist_entry_id is nullable (migration 012) — appointment-based candidates don't have one
  const { error: insertError } = await supabase
    .from("waitlist_offers")
    .insert({
      id: offerId,
      tenant_id: input.tenantId,
      original_appointment_id: input.originalAppointmentId,
      waitlist_entry_id: input.candidate.waitlistEntryId ?? null,
      candidate_appointment_id: input.candidate.candidateAppointmentId ?? null,
      patient_id: input.candidate.patientId,
      status: "pending",
      smart_score: input.candidate.candidateScore.total,
      smart_score_breakdown: input.candidate.candidateScore,
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

  // Format offered slot date/time
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

  // Format candidate's current appointment date/time for comparison (null for waitlist candidates)
  const currentApptDate = input.candidate.currentAppointmentAt
    ? input.candidate.currentAppointmentAt.toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : undefined;
  const currentApptTime = input.candidate.currentAppointmentAt
    ? input.candidate.currentAppointmentAt.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : undefined;

  // Format expiry description for messages
  const expiryDesc = effectiveExpiry >= 60
    ? `${Math.round(effectiveExpiry / 60)} ora`
    : `${effectiveExpiry} minuti`;

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
    current_appointment_date: currentApptDate,
    current_appointment_time: currentApptTime,
    expiry_description: expiryDesc,
  };

  // Determine channel using learned response patterns, falling back to patient preference
  const optimalTiming = await getOptimalContactTime(supabase, input.candidate.patientId);
  const channel = optimalTiming.dataPoints >= 3
    ? optimalTiming.channel
    : input.candidate.preferredChannel;
  let body: string;
  let subject: string | undefined;
  let to: string;

  let contentSid: string | undefined;
  let contentVariables: string | undefined;

  if (channel === "whatsapp") {
    body = renderOfferWhatsApp(templateVars);
    to = input.candidate.patientPhone ?? "";
    // Use approved Content Template for WhatsApp (works outside 24h window)
    contentSid = CONTENT_SIDS.backfill_offer;
    contentVariables = buildBackfillOfferVars({
      patientName: input.candidate.patientName,
      serviceName: input.serviceName,
      date: dateStr,
      time: timeStr,
      expiresAt: expiresStr,
    });
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

  // Add urgency prefix for critical-time slots
  if (input.urgencyPrefix) {
    body = `🚨 ${input.urgencyPrefix}: ${body}`;
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
  const sendResult = await sendNotification({ to, body, channel: effectiveChannel, subject, tenantId: input.tenantId, contentSid, contentVariables });

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

  logAuditEvent({
    tenantId: input.tenantId,
    actorType: "system",
    entityType: "offer",
    entityId: offerId,
    action: "offer.sent",
    metadata: {
      patient_id: input.candidate.patientId,
      original_appointment_id: input.originalAppointmentId,
      channel: effectiveChannel,
    },
  });

  // Dispatch webhook for slot offered
  try {
    await dispatchWebhookEvent(input.tenantId, "waitlist.slot_offered", {
      offer_id: offerId,
      original_appointment_id: input.originalAppointmentId,
      patient_id: input.candidate.patientId,
      patient_name: input.candidate.patientName,
      service_name: input.serviceName,
      scheduled_at: input.scheduledAt.toISOString(),
      channel: effectiveChannel,
    });
  } catch { /* webhook delivery is best-effort */ }

  return { offerId, status: "sent" };
}
