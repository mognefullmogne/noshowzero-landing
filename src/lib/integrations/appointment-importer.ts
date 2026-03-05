// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Core import pipeline: NormalizedCalendarEvent[] → enriched appointments.
 * Reuses existing risk scoring, reminder scheduling, and confirmation workflows.
 *
 * For each event:
 * 1. Cancelled events → cancel existing appointment + trigger backfill
 * 2. Skip past events
 * 3. Dedup by external_id
 * 4. Find or create patient from attendees
 * 5. Create appointment with risk scoring + reminders + confirmation
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NormalizedCalendarEvent,
  ImportResult,
  ImportError,
} from "./types";
import { triggerBackfill } from "@/lib/backfill/trigger-backfill";
import { computeRiskScore } from "@/lib/scoring/risk-score";
import {
  generateContactSchedule,
  scheduleToReminders,
} from "@/lib/scoring/contact-timing";
import { createConfirmationWorkflow } from "@/lib/confirmation/workflow";
import type { MessageChannel } from "@/lib/types";

const ONE_HOUR_MS = 3_600_000;

export async function importCalendarEvents(
  supabase: SupabaseClient,
  tenantId: string,
  events: readonly NormalizedCalendarEvent[]
): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: ImportError[] = [];
  const now = new Date();

  for (const event of events) {
    try {
      // 1. Cancelled events: if we previously imported this event, cancel the
      //    appointment and trigger backfill so the AI fills the freed slot.
      if (event.status === "cancelled") {
        if (event.externalId) {
          const cancelled = await handleExternalCancellation(
            supabase,
            tenantId,
            event.externalId
          );
          if (cancelled) {
            imported++; // counts as a meaningful sync action
            continue;
          }
        }
        skipped++;
        continue;
      }

      // 2. Skip past events (more than 1 hour ago)
      const eventEnd = new Date(event.endAt);
      if (eventEnd.getTime() < now.getTime() - ONE_HOUR_MS) {
        skipped++;
        continue;
      }

      // 3. Dedup: check if external_id already exists for this tenant
      const { data: existing } = await supabase
        .from("appointments")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("external_id", event.externalId)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // 4. Find or create patient from attendees
      const patientId = await findOrCreatePatient(
        supabase,
        tenantId,
        event.attendees,
        event.summary
      );

      // 5. Compute appointment fields
      const scheduledAt = new Date(event.startAt);
      const durationMs = eventEnd.getTime() - scheduledAt.getTime();
      const durationMin = Math.max(5, Math.round(durationMs / 60_000)) || 30;

      // 6. Get patient history for risk scoring
      const [{ count: totalAppts }, { count: noShows }] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", patientId)
          .eq("tenant_id", tenantId),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", patientId)
          .eq("tenant_id", tenantId)
          .eq("status", "no_show"),
      ]);

      // 7. Compute risk score
      const riskResult = computeRiskScore({
        totalAppointments: totalAppts ?? 0,
        noShows: noShows ?? 0,
        scheduledAt,
        createdAt: now,
      });

      // 8. Insert appointment
      const { data: appointment, error: insertError } = await supabase
        .from("appointments")
        .insert({
          tenant_id: tenantId,
          patient_id: patientId,
          service_name: sanitizeSummary(event.summary),
          location_name: event.location ?? null,
          scheduled_at: event.startAt,
          duration_min: durationMin,
          status: "scheduled",
          external_id: event.externalId,
          notes: event.description ?? null,
          risk_score: riskResult.score,
          risk_reasoning: riskResult.reasoning,
          risk_scored_at: now.toISOString(),
        })
        .select("id")
        .single();

      if (insertError || !appointment) {
        failed++;
        errors.push({
          eventSummary: event.summary,
          reason: insertError?.message ?? "insert_failed",
        });
        continue;
      }

      // 9. Get patient preferred channel
      const { data: patient } = await supabase
        .from("patients")
        .select("preferred_channel")
        .eq("id", patientId)
        .maybeSingle();

      const preferredChannel: MessageChannel =
        (patient?.preferred_channel as MessageChannel) ?? "email";

      // 10. Schedule reminders
      const schedule = generateContactSchedule(
        riskResult.score,
        preferredChannel
      );
      const reminderTimes = scheduleToReminders(scheduledAt, schedule);

      if (reminderTimes.length > 0) {
        const reminderRows = reminderTimes.map((r) => ({
          tenant_id: tenantId,
          appointment_id: appointment.id,
          channel: r.channel,
          message_tone: r.messageTone,
          scheduled_at: r.scheduledAt.toISOString(),
          status: "pending",
        }));

        await supabase.from("reminders").insert(reminderRows);
      }

      // 11. Create confirmation workflow (non-blocking)
      createConfirmationWorkflow(
        supabase,
        tenantId,
        appointment.id,
        scheduledAt
      ).catch((err) =>
        console.error("[Importer] Workflow error:", err)
      );

      imported++;
    } catch (err) {
      failed++;
      errors.push({
        eventSummary: event.summary,
        reason: err instanceof Error ? err.message : "unexpected_error",
      });
    }
  }

  return {
    total: events.length,
    imported,
    skipped,
    failed,
    errors,
  };
}

/**
 * Find an existing patient by phone, email, or name.
 * Creates a new patient if none found.
 */
async function findOrCreatePatient(
  supabase: SupabaseClient,
  tenantId: string,
  attendees: readonly { name?: string; email?: string; phone?: string }[],
  eventSummary: string
): Promise<string> {
  // Try each attendee — find by phone first, then email
  for (const attendee of attendees) {
    if (attendee.phone) {
      const { data } = await supabase
        .from("patients")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("phone", attendee.phone)
        .maybeSingle();
      if (data) return data.id;
    }

    if (attendee.email) {
      const { data } = await supabase
        .from("patients")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", attendee.email)
        .maybeSingle();
      if (data) return data.id;
    }
  }

  // No existing patient found — create one from first attendee with a name
  const bestAttendee = attendees.find((a) => a.name) ?? attendees[0];
  const { firstName, lastName } = parseName(
    bestAttendee?.name ?? eventSummary
  );

  const { data: newPatient, error } = await supabase
    .from("patients")
    .insert({
      tenant_id: tenantId,
      first_name: firstName,
      last_name: lastName,
      phone: bestAttendee?.phone ?? null,
      email: bestAttendee?.email ?? null,
      preferred_channel: bestAttendee?.email ? "email" : "whatsapp",
    })
    .select("id")
    .single();

  if (error || !newPatient) {
    throw new Error(`Failed to create patient: ${error?.message}`);
  }

  return newPatient.id;
}

function parseName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) {
    return { firstName: trimmed, lastName: "" };
  }
  return {
    firstName: trimmed.slice(0, spaceIdx),
    lastName: trimmed.slice(spaceIdx + 1),
  };
}

/**
 * When an external calendar event is cancelled, find the matching appointment
 * and cancel it — then trigger backfill so the AI fills the freed slot.
 * Returns true if an appointment was actually cancelled.
 */
async function handleExternalCancellation(
  supabase: SupabaseClient,
  tenantId: string,
  externalId: string
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("external_id", externalId)
    .maybeSingle();

  if (!existing) return false;

  // Already cancelled/completed — nothing to do
  if (["cancelled", "no_show", "completed"].includes(existing.status)) {
    return false;
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      declined_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[Importer] Failed to cancel synced appointment:", existing.id, error);
    return false;
  }

  console.info(
    `[Importer] External cancellation → appointment ${existing.id} cancelled, triggering backfill`
  );

  // Trigger backfill to fill the freed slot (fire-and-forget)
  triggerBackfill(supabase, existing.id, tenantId, { triggerEvent: "cancellation" }).catch(
    (err) => console.error("[Importer] Backfill after external cancel failed:", err)
  );

  return true;
}

/** Strip control characters from event summary for use as service_name */
function sanitizeSummary(summary: string): string {
  // eslint-disable-next-line no-control-regex
  return summary.replace(/[\x00-\x1F\x7F]/g, "").trim() || "Appuntamento";
}
