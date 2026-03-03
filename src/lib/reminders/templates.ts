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
      `Gentile ${vars.patientName},`,
      "",
      `le ricordiamo il suo appuntamento imminente:`,
      `📋 ${vars.serviceName}${provider}`,
      `📅 ${vars.date} alle ${vars.time}${location}`,
      "",
      `La preghiamo di confermare la sua presenza rispondendo *SI*`,
      `Se non può venire, rispondi *NO* per permetterci di offrire il posto ad un altro paziente.`,
      "",
      `Grazie!`,
    ].join("\n");
  }

  return [
    `Gentile ${vars.patientName},`,
    "",
    `le ricordiamo il suo prossimo appuntamento:`,
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
