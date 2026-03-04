/**
 * Message templates for waitlist offer notifications.
 * WhatsApp uses Italian reply-based format (SI/NO).
 * SMS/email fallback still uses URL-based accept/decline links.
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
  readonly current_appointment_date?: string;
  readonly current_appointment_time?: string;
  readonly [key: string]: string | undefined;
}

function render(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

const TEMPLATES = {
  waitlist_offer_whatsapp: `Ciao {{patient_name}}! Si è liberato un posto per {{service_name}} il {{date}} alle {{time}}{{location_suffix}}{{provider_suffix}}.

Il tuo appuntamento attuale è il {{current_appointment_date}} alle {{current_appointment_time}}.

Hai {{expiry_description}} per rispondere (scade alle {{expires_at}}).

Rispondi SI per accettare o NO per rifiutare.`,

  waitlist_offer_sms: `NoShowZero: Posto disponibile per {{service_name}} il {{date}} {{time}}. Accetta: {{accept_url}} | Rifiuta: {{decline_url}} (scade {{expires_at}})`,

  waitlist_offer_email_subject: `Posto disponibile: {{service_name}} il {{date}} alle {{time}}`,

  waitlist_offer_email_body: `Ciao {{patient_name}}!

Buone notizie! Si è liberato un posto per il servizio che stavi aspettando.

📋 Servizio: {{service_name}}
📅 Data: {{date}}
🕐 Ora: {{time}}{{location_line}}{{provider_line}}

Hai {{expiry_description}} per accettare (scade alle {{expires_at}}).

👉 Per ACCETTARE: {{accept_url}}
👉 Per RIFIUTARE: {{decline_url}}
👉 Stato offerta: {{status_url}}

Se non rispondi entro la scadenza, il posto verrà offerto al prossimo paziente in lista d'attesa.

A presto!
Il team NoShowZero`,
} as const;

export function renderOfferWhatsApp(vars: TemplateVars): string {
  const locationSuffix = vars.location_name ? ` presso ${vars.location_name}` : "";
  const providerSuffix = vars.provider_name ? ` con ${vars.provider_name}` : "";
  return render(TEMPLATES.waitlist_offer_whatsapp, {
    ...vars,
    location_suffix: locationSuffix,
    provider_suffix: providerSuffix,
  });
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
