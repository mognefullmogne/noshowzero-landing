// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Reminder message templates for WhatsApp/SMS.
 * Separate from confirmation templates — these are pre-appointment reminders.
 */

interface ReminderVars {
  readonly patientName: string;
  readonly serviceName: string;
  readonly date: string;
  readonly time: string;
  readonly providerName?: string;
  readonly locationName?: string;
  readonly tone: "standard" | "urgent";
}

export function renderReminderWhatsApp(vars: ReminderVars): string {
  const provider = vars.providerName ? ` con ${vars.providerName}` : "";
  const location = vars.locationName ? ` presso ${vars.locationName}` : "";

  if (vars.tone === "urgent") {
    return [
      `Ciao ${vars.patientName}!`,
      "",
      `Ti ricordiamo il tuo appuntamento imminente:`,
      `📋 ${vars.serviceName}${provider}`,
      `📅 ${vars.date} alle ${vars.time}${location}`,
      "",
      `Conferma la tua presenza rispondendo *SI*`,
      `Se non puoi venire, rispondi *NO* e offriamo il posto a chi ne ha bisogno.`,
      "",
      `Grazie!`,
    ].join("\n");
  }

  return [
    `Ciao ${vars.patientName}!`,
    "",
    `Ti ricordiamo il tuo prossimo appuntamento:`,
    `📋 ${vars.serviceName}${provider}`,
    `📅 ${vars.date} alle ${vars.time}${location}`,
    "",
    `Per confermare rispondi *SI*`,
    `Per cancellare rispondi *NO*`,
    "",
    `Grazie!`,
  ].join("\n");
}

export function renderReminderSms(vars: ReminderVars): string {
  if (vars.tone === "urgent") {
    return `Promemoria URGENTE: ${vars.serviceName} il ${vars.date} ore ${vars.time}. Confermi? Rispondi SI o NO.`;
  }
  return `Promemoria: ${vars.serviceName} il ${vars.date} ore ${vars.time}. Confermi? Rispondi SI o NO.`;
}
