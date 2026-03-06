// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * WhatsApp Content Template SIDs (Twilio Content API).
 * Only approved templates are listed here. Templates pending Meta approval
 * must NOT be added — callers fall back to freeform body text.
 *
 * Variables use 1-indexed keys: {"1": "name", "2": "service", ...}
 */

/** Registry of approved Content SIDs keyed by template name. */
export const CONTENT_SIDS = {
  appointment_confirmation: "HX692673826556aac6f477f66f3a5831a9",
  backfill_offer: "HX9fd4c0a9fcece8d9f3d66df6cc1766de",
  appointment_reminder: "HXc7700b93275ace01bfbc8a8db18457d5",
  confirmation_reminder: "HXf7add83bca4873f99116783359884703",
  // final_warning: pending approval
} as const;

export type ContentTemplateName = keyof typeof CONTENT_SIDS;

/** Messaging Service SID — required when sending Content Templates via Twilio. */
export const MESSAGING_SERVICE_SID = "MG2b3b5573ab7a04bf5428a5c563846fe7";

/**
 * Build contentVariables JSON for the appointment_confirmation template.
 * Variables: {{1}}=name, {{2}}=service, {{3}}=date, {{4}}=time
 */
export function buildConfirmationVars(params: {
  readonly patientName: string;
  readonly serviceName: string;
  readonly date: string;
  readonly time: string;
}): string {
  return JSON.stringify({
    "1": params.patientName,
    "2": params.serviceName,
    "3": params.date,
    "4": params.time,
  });
}

/**
 * Build contentVariables JSON for the backfill_offer template.
 * Variables: {{1}}=name, {{2}}=service, {{3}}=date, {{4}}=time, {{5}}=expires_at
 */
export function buildBackfillOfferVars(params: {
  readonly patientName: string;
  readonly serviceName: string;
  readonly date: string;
  readonly time: string;
  readonly expiresAt: string;
}): string {
  return JSON.stringify({
    "1": params.patientName,
    "2": params.serviceName,
    "3": params.date,
    "4": params.time,
    "5": params.expiresAt,
  });
}

/**
 * Build contentVariables JSON for the appointment_reminder template.
 * Variables: {{1}}=name, {{2}}=service, {{3}}=date, {{4}}=time
 */
export function buildReminderVars(params: {
  readonly patientName: string;
  readonly serviceName: string;
  readonly date: string;
  readonly time: string;
}): string {
  return JSON.stringify({
    "1": params.patientName,
    "2": params.serviceName,
    "3": params.date,
    "4": params.time,
  });
}

/**
 * Build contentVariables JSON for the confirmation_reminder template.
 * Variables: {{1}}=name, {{2}}=service, {{3}}=date, {{4}}=time
 */
export function buildConfirmationReminderVars(params: {
  readonly patientName: string;
  readonly serviceName: string;
  readonly date: string;
  readonly time: string;
}): string {
  return JSON.stringify({
    "1": params.patientName,
    "2": params.serviceName,
    "3": params.date,
    "4": params.time,
  });
}
