// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * POST /api/rules/seed — Create default business rules for the tenant.
 * Idempotent: skips rules that already exist (by name).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";

interface DefaultRule {
  readonly name: string;
  readonly description: string;
  readonly entity_type: string;
  readonly conditions: readonly Record<string, unknown>[];
  readonly actions: readonly Record<string, unknown>[];
}

const DEFAULT_RULES: readonly DefaultRule[] = [
  {
    name: "Standard Reminder Timing",
    description:
      "Send appointment reminder 48 hours before scheduled time. This is the default timing for all appointments.",
    entity_type: "reminder",
    conditions: [
      { field: "hours_before_appointment", operator: "gte", value: 48 },
      { field: "risk_score", operator: "lt", value: 60 },
    ],
    actions: [
      {
        type: "send_reminder",
        params: { hours_before: 48, channel: "preferred", template: "standard_reminder" },
      },
    ],
  },
  {
    name: "High-Risk Extra Reminder",
    description:
      "Patients with risk score ≥ 60 receive an additional reminder 72 hours before appointment for extra engagement.",
    entity_type: "reminder",
    conditions: [
      { field: "risk_score", operator: "gte", value: 60 },
    ],
    actions: [
      {
        type: "send_reminder",
        params: { hours_before: 72, channel: "preferred", template: "high_risk_reminder" },
      },
      {
        type: "send_reminder",
        params: { hours_before: 48, channel: "preferred", template: "standard_reminder" },
      },
    ],
  },
  {
    name: "Confirmation Deadline",
    description:
      "Patients must confirm their appointment at least 24 hours before. After this deadline, the system triggers timeout actions.",
    entity_type: "appointment",
    conditions: [
      { field: "status", operator: "eq", value: "reminder_sent" },
      { field: "hours_until_appointment", operator: "lte", value: 24 },
    ],
    actions: [
      {
        type: "set_status",
        params: { new_status: "timeout", notify_operator: true },
      },
    ],
  },
  {
    name: "Auto-Confirm Low Risk",
    description:
      "Automatically confirm appointments for patients with risk score < 20 and a good attendance history (≥ 3 completed appointments).",
    entity_type: "appointment",
    conditions: [
      { field: "risk_score", operator: "lt", value: 20 },
      { field: "patient.completed_appointments", operator: "gte", value: 3 },
    ],
    actions: [
      {
        type: "set_status",
        params: { new_status: "confirmed" },
      },
    ],
  },
  {
    name: "Waitlist Offer Timeout",
    description:
      "Backfill offers expire after 2 hours if the patient doesn't respond. The offer is then sent to the next candidate.",
    entity_type: "offer",
    conditions: [
      { field: "status", operator: "eq", value: "pending" },
      { field: "hours_since_offered", operator: "gte", value: 2 },
    ],
    actions: [
      {
        type: "expire_offer",
        params: { notify_patient: true, try_next_candidate: true },
      },
    ],
  },
  {
    name: "Max Offers Per Waitlist Entry",
    description:
      "Each waitlist entry can receive a maximum of 3 offers. After 3 declined/expired offers, the entry is paused for manual review.",
    entity_type: "waitlist",
    conditions: [
      { field: "total_offers_sent", operator: "gte", value: 3 },
    ],
    actions: [
      {
        type: "pause_entry",
        params: { reason: "max_offers_reached", notify_operator: true },
      },
    ],
  },
  {
    name: "No-Show Streak Alert",
    description:
      "Flag patients who have 2 or more consecutive no-shows. Operator is notified for manual follow-up.",
    entity_type: "appointment",
    conditions: [
      { field: "patient.consecutive_no_shows", operator: "gte", value: 2 },
    ],
    actions: [
      {
        type: "flag_patient",
        params: { reason: "no_show_streak", notify_operator: true },
      },
    ],
  },
  {
    name: "Short-Notice Cancel → Backfill",
    description:
      "When an appointment is cancelled less than 24 hours before, immediately trigger the backfill engine to find a replacement.",
    entity_type: "appointment",
    conditions: [
      { field: "status", operator: "eq", value: "cancelled" },
      { field: "hours_until_appointment", operator: "lte", value: 24 },
    ],
    actions: [
      {
        type: "trigger_backfill",
        params: { priority: "high", max_offers: 3 },
      },
    ],
  },
];

export async function POST() {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const tenantId = auth.data.tenantId;

  // Get existing rule names to avoid duplicates
  const { data: existing, error: fetchError } = await supabase
    .from("rulesets")
    .select("name")
    .eq("tenant_id", tenantId);

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: fetchError.message } },
      { status: 500 }
    );
  }

  const existingNames = new Set((existing ?? []).map((r) => r.name));
  const rulesToCreate = DEFAULT_RULES.filter((r) => !existingNames.has(r.name));

  if (rulesToCreate.length === 0) {
    return NextResponse.json({
      success: true,
      data: { created: 0, message: "All default rules already exist" },
    });
  }

  let created = 0;

  for (const rule of rulesToCreate) {
    // Create ruleset
    const { data: ruleset, error: rulesetError } = await supabase
      .from("rulesets")
      .insert({
        tenant_id: tenantId,
        name: rule.name,
        description: rule.description,
        entity_type: rule.entity_type,
        is_active: true,
      })
      .select("id")
      .single();

    if (rulesetError) {
      continue;
    }

    // Create version 1
    const { error: versionError } = await supabase.from("rule_versions").insert({
      ruleset_id: ruleset.id,
      tenant_id: tenantId,
      version: 1,
      conditions: rule.conditions,
      actions: rule.actions,
      is_active: true,
      notes: "Default rule — auto-generated",
    });

    if (versionError) {
      // Clean up orphaned ruleset
      await supabase.from("rulesets").delete().eq("id", ruleset.id);
      continue;
    }

    created++;
  }

  return NextResponse.json({
    success: true,
    data: { created, total: DEFAULT_RULES.length, message: `Created ${created} default rules` },
  });
}
