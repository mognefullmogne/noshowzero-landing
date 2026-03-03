/**
 * Message templates for waitlist offer notifications.
 * Matches the template system from the NestJS local version.
 */

export interface TemplateVars {
  readonly patient_name: string;
  readonly service_name: string;
  readonly date: string;
  readonly time: string;
  readonly provider_name?: string;
  readonly location_name?: string;
  readonly accept_url: string;
  readonly decline_url: string;
  readonly status_url: string;
  readonly expires_at: string;
  readonly [key: string]: string | undefined;
}

function render(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

const TEMPLATES = {
  waitlist_offer_whatsapp: `Gentile {{patient_name}}, si è liberato uno slot per {{service_name}} il {{date}} alle {{time}}{{location_suffix}}.

Desidera prenotarlo? Ha 2 ore per rispondere.

✅ Accettare: {{accept_url}}
❌ Rifiutare: {{decline_url}}

Lo slot scade alle {{expires_at}}.`,

  waitlist_offer_sms: `NoShowZero: Slot disponibile per {{service_name}} il {{date}} {{time}}. Accetta: {{accept_url}} | Rifiuta: {{decline_url}} (scade {{expires_at}})`,

  waitlist_offer_email_subject: `Slot disponibile: {{service_name}} il {{date}} alle {{time}}`,

  waitlist_offer_email_body: `Gentile {{patient_name}},

Buone notizie! Si è liberato uno slot per il servizio che stava aspettando.

📋 Servizio: {{service_name}}
📅 Data: {{date}}
🕐 Ora: {{time}}{{location_line}}{{provider_line}}

Ha 2 ore per accettare questo slot (scade alle {{expires_at}}).

👉 Per ACCETTARE: {{accept_url}}
👉 Per RIFIUTARE: {{decline_url}}
👉 Stato offerta: {{status_url}}

Se non risponde entro la scadenza, lo slot verrà offerto al prossimo paziente in lista d'attesa.

Cordiali saluti,
Il team NoShowZero`,
} as const;

export function renderOfferWhatsApp(vars: TemplateVars): string {
  const locationSuffix = vars.location_name ? ` presso ${vars.location_name}` : "";
  return render(TEMPLATES.waitlist_offer_whatsapp, { ...vars, location_suffix: locationSuffix });
}

export function renderOfferSms(vars: TemplateVars): string {
  return render(TEMPLATES.waitlist_offer_sms, vars);
}

export function renderOfferEmailSubject(vars: TemplateVars): string {
  return render(TEMPLATES.waitlist_offer_email_subject, vars);
}

export function renderOfferEmailBody(vars: TemplateVars): string {
  const locationLine = vars.location_name ? `\n📍 Sede: ${vars.location_name}` : "";
  const providerLine = vars.provider_name ? `\n👨‍⚕️ Dottore: ${vars.provider_name}` : "";
  return render(TEMPLATES.waitlist_offer_email_body, {
    ...vars,
    location_line: locationLine,
    provider_line: providerLine,
  });
}
