// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Confirmation message templates for WhatsApp/SMS.
 * Includes multi-touch escalation templates (Touch 1, 2, 3).
 */

interface ConfirmationVars {
  readonly patientName: string;
  readonly serviceName: string;
  readonly date: string;
  readonly time: string;
  readonly providerName?: string;
  readonly locationName?: string;
}

// --- Touch 1: Initial confirmation (existing) ---

export function renderConfirmationWhatsApp(vars: ConfirmationVars): string {
  const provider = vars.providerName ? ` con ${vars.providerName}` : "";
  const location = vars.locationName ? ` presso ${vars.locationName}` : "";

  return [
    `Ciao ${vars.patientName}!`,
    "",
    `Ti ricordiamo il tuo appuntamento:`,
    `📋 ${vars.serviceName}${provider}`,
    `📅 ${vars.date} alle ${vars.time}${location}`,
    "",
    `Per confermare rispondi *SI*`,
    `Per cancellare rispondi *NO*`,
    "",
    `A presto!`,
  ].join("\n");
}

export function renderConfirmationSms(vars: ConfirmationVars): string {
  return `Appuntamento ${vars.serviceName} il ${vars.date} ore ${vars.time}. Confermi? Rispondi SI o NO.`;
}

// --- Touch 2: Reminder (24h before) ---

export function renderReminderSms(vars: ConfirmationVars): string {
  const provider = vars.providerName ? ` con ${vars.providerName}` : "";
  return (
    `Non abbiamo ricevuto conferma per il tuo appuntamento domani: ` +
    `${vars.serviceName}${provider} il ${vars.date} ore ${vars.time}. ` +
    `Rispondi SI per confermare o NO per cancellare.`
  );
}

export function renderReminderWhatsApp(vars: ConfirmationVars): string {
  const provider = vars.providerName ? ` con ${vars.providerName}` : "";
  const location = vars.locationName ? ` presso ${vars.locationName}` : "";

  return [
    `Ciao ${vars.patientName}!`,
    "",
    `Non abbiamo ancora ricevuto la tua conferma per l'appuntamento di domani:`,
    `📋 ${vars.serviceName}${provider}`,
    `📅 ${vars.date} alle ${vars.time}${location}`,
    "",
    `Rispondi *SI* per confermare o *NO* per cancellare.`,
    "",
    `Grazie!`,
  ].join("\n");
}

// --- Touch 3: Final warning (6h before) ---

export function renderFinalWarningSms(vars: ConfirmationVars): string {
  return (
    `ULTIMO AVVISO: Il tuo appuntamento ${vars.serviceName} è tra poche ore ` +
    `(${vars.date} ore ${vars.time}). Rispondi SI per confermare o il posto verrà offerto ad altri.`
  );
}

export function renderFinalWarningWhatsApp(vars: ConfirmationVars): string {
  const provider = vars.providerName ? ` con ${vars.providerName}` : "";
  const location = vars.locationName ? ` presso ${vars.locationName}` : "";

  return [
    `⚠️ *ULTIMO AVVISO*`,
    "",
    `Ciao ${vars.patientName},`,
    `il tuo appuntamento è tra poche ore:`,
    `📋 ${vars.serviceName}${provider}`,
    `📅 ${vars.date} alle ${vars.time}${location}`,
    "",
    `Rispondi *SI* per confermare o il posto verrà offerto ad altri pazienti.`,
  ].join("\n");
}
