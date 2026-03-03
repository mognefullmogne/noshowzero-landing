/**
 * Confirmation message templates for WhatsApp/SMS.
 */

interface ConfirmationVars {
  readonly patientName: string;
  readonly serviceName: string;
  readonly date: string;
  readonly time: string;
  readonly providerName?: string;
  readonly locationName?: string;
}

export function renderConfirmationWhatsApp(vars: ConfirmationVars): string {
  const provider = vars.providerName ? ` con ${vars.providerName}` : "";
  const location = vars.locationName ? ` presso ${vars.locationName}` : "";

  return [
    `Gentile ${vars.patientName},`,
    "",
    `le ricordiamo il suo appuntamento:`,
    `📋 ${vars.serviceName}${provider}`,
    `📅 ${vars.date} alle ${vars.time}${location}`,
    "",
    `Per confermare rispondi *SI*`,
    `Per cancellare rispondi *NO*`,
    "",
    `Grazie!`,
  ].join("\n");
}

export function renderConfirmationSms(vars: ConfirmationVars): string {
  return `Appuntamento ${vars.serviceName} il ${vars.date} ore ${vars.time}. Confermi? Rispondi SI o NO.`;
}
