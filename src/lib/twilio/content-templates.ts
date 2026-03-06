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
  // backfill_offer: pending approval
  // final_warning: pending approval
  // appointment_reminder: pending approval
  // confirmation_reminder: pending approval
} as const;

export type ContentTemplateName = keyof typeof CONTENT_SIDS;

/** Messaging Service SID — required when sending Content Templates via Twilio. */
export const MESSAGING_SERVICE_SID = "MG2b3b5573ab7a04bf5428a5c563846fe7";

/**
 * Build contentVariables JSON for the appointment_confirmation template.
 * Template body: "Ciao {{1}}, ti ricordiamo il tuo appuntamento:\n{{2}}\n{{3}} alle {{4}}\n\nConfermi la tua presenza?"
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
