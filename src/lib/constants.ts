// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

export const SITE_NAME = "NoShow";
export const SITE_DESCRIPTION =
  "Elimina i no-show, riempi gli slot vuoti e aumenta il fatturato con la gestione appuntamenti basata sull'IA.";
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const NAV_LINKS = [
  { label: "Funzionalità", href: "/#features" },
  { label: "Prezzi", href: "/pricing" },
] as const;

export const INDUSTRIES = [
  { name: "Sanità", icon: "Stethoscope", description: "Cliniche, ospedali, telemedicina" },
  { name: "Dentistico", icon: "SmilePlus", description: "Studi dentistici e ortodonzia" },
  { name: "Salone & Spa", icon: "Scissors", description: "Parrucchieri, spa, estetica" },
  { name: "Autofficina", icon: "Car", description: "Meccanici, carrozzieri, concessionari" },
  { name: "Fitness", icon: "Dumbbell", description: "Palestre, personal training, yoga" },
  { name: "Professionisti", icon: "Briefcase", description: "Consulenza, legale, finanziario" },
] as const;

export type PlanTier = "starter" | "growth" | "enterprise";

export interface PricingPlan {
  readonly name: string;
  readonly tier: PlanTier;
  readonly monthlyPrice: number;
  readonly annualPrice: number;
  readonly description: string;
  readonly features: readonly string[];
  readonly highlighted: boolean;
  readonly cta: string;
  readonly limits: {
    readonly appointments: string;
    readonly locations: string;
    readonly users: string;
  };
}

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    name: "Starter",
    tier: "starter",
    monthlyPrice: 90,
    annualPrice: 864,
    description: "Perfetto per professionisti singoli e freelance.",
    highlighted: false,
    cta: "Inizia la Prova Gratuita",
    limits: { appointments: "100/mese", locations: "1", users: "1" },
    features: [
      "100 appuntamenti/mese",
      "1 sede",
      "1 membro del team",
      "Promemoria intelligenti con IA (WhatsApp, SMS, Email)",
      "Punteggio rischio no-show con IA",
      "Lista d'attesa IA con riempimento automatico",
      "Statistiche e report",
      "Supporto via email",
    ],
  },
  {
    name: "Growth",
    tier: "growth",
    monthlyPrice: 160,
    annualPrice: 1536,
    description: "Per studi e attività in crescita con più sedi.",
    highlighted: true,
    cta: "Inizia la Prova Gratuita",
    limits: { appointments: "1.000/mese", locations: "2", users: "5" },
    features: [
      "1.000 appuntamenti/mese",
      "Fino a 2 sedi",
      "5 membri del team",
      "Tutto quello di Starter, più:",
      "Motore IA di ottimizzazione calendario",
      "Suggerimenti proattivi di riprogrammazione IA",
      "Ranking avanzato lista d'attesa IA",
      "Accesso API REST + Webhooks",
      "Statistiche avanzate + dashboard ROI",
      "Template promemoria personalizzabili",
      "Supporto prioritario",
    ],
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    monthlyPrice: 499,
    annualPrice: 4790,
    description: "Per grandi organizzazioni e reti ospedaliere.",
    highlighted: false,
    cta: "Inizia la Prova Gratuita",
    limits: { appointments: "Illimitati", locations: "Illimitate", users: "Illimitati" },
    features: [
      "Appuntamenti illimitati",
      "Sedi illimitate",
      "Membri del team illimitati",
      "Tutto quello di Growth, più:",
      "Motore decisionale IA completo con modelli personalizzati",
      "Ottimizzazione IA dei tempi di contatto",
      "API completa + FHIR + SSO",
      "Statistiche e report personalizzati",
      "Account manager dedicato",
      "Garanzia SLA",
      "Opzione white-label",
    ],
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "Come funziona la prova gratuita di 14 giorni?",
    answer:
      "Registrati e ottieni accesso completo al piano scelto per 14 giorni — nessuna carta di credito richiesta. Se ti piace, aggiungi i dati di pagamento per continuare. Altrimenti, il tuo account si mette semplicemente in pausa.",
  },
  {
    question: "Quali canali supportano i promemoria?",
    answer:
      "Inviamo promemoria via WhatsApp, SMS ed email. Puoi configurare quali canali usare per ogni tipo di appuntamento e personalizzare i template dei messaggi e i tempi di invio.",
  },
  {
    question: "Come funziona la lista d'attesa IA?",
    answer:
      "Quando si libera uno slot (cancellazione o no-show), la nostra IA valuta i pazienti in lista d'attesa in base a urgenza, affidabilità, preferenza oraria, distanza e altro — poi offre automaticamente lo slot alla migliore corrispondenza.",
  },
  {
    question: "Posso integrarlo con il mio software gestionale?",
    answer:
      "Sì! Le nostre API REST e i webhooks ti permettono di collegare NoShow a qualsiasi sistema di prenotazione. Forniamo SDK, documentazione e codice di esempio per iniziare in pochi minuti.",
  },
  {
    question: "I miei dati sono al sicuro?",
    answer:
      "Assolutamente. Utilizziamo crittografia end-to-end, infrastruttura conforme SOC 2 e seguiamo le linee guida HIPAA per i dati sanitari. I tuoi dati non escono mai dal nostro cloud sicuro.",
  },
  {
    question: "Posso cambiare piano in seguito?",
    answer:
      "Sì, puoi fare upgrade o downgrade in qualsiasi momento. Le modifiche hanno effetto all'inizio del ciclo di fatturazione successivo. Se fai upgrade a metà ciclo, calcoliamo la differenza proporzionalmente.",
  },
  {
    question: "Cosa succede se supero il limite di appuntamenti?",
    answer:
      "Ti avviseremo quando raggiungi l'80% del limite. Se lo superi, i promemoria continuano a funzionare ma i nuovi appuntamenti vengono messi in coda fino al ciclo successivo — oppure puoi fare upgrade istantaneamente.",
  },
  {
    question: "Offrite sconti per la fatturazione annuale?",
    answer:
      "Sì! La fatturazione annuale ti fa risparmiare circa il 15-20% rispetto alla mensile. Growth scende da €199/mese a €169/mese, Professional da €499/mese a €399/mese ed Enterprise da €999/mese a €849/mese.",
  },
] as const;

export const TESTIMONIALS = [
  {
    name: "Dr.ssa Sara Bianchi",
    role: "Titolare, Studio Dentistico Sorriso",
    content:
      "Il nostro tasso di no-show è sceso dal 22% a meno del 4% nel primo mese. La lista d'attesa IA riempie gli slot cancellati in pochi minuti. Ha rivoluzionato il nostro studio.",
    avatar: "SB",
  },
  {
    name: "Marco Rossi",
    role: "Manager, UrbanFit Palestra",
    content:
      "Perdevamo migliaia di euro ogni mese per sessioni PT saltate. I promemoria intelligenti e la riprenotazione automatica di NoShow hanno recuperato oltre €12.000 nel primo trimestre.",
    avatar: "MR",
  },
  {
    name: "Lisa Parisi",
    role: "Titolare, Glow Beauty Studio",
    content:
      "La configurazione ha richiesto 15 minuti con l'API. Ora i nostri clienti ricevono promemoria WhatsApp, e quando qualcuno cancella, il prossimo in lista d'attesa viene avvisato istantaneamente.",
    avatar: "LP",
  },
] as const;

export const STATS = [
  { value: 23, suffix: "%", prefix: "", label: "Tasso medio di no-show in tutti i settori" },
  { value: 150, suffix: " mld", prefix: "$", label: "Persi ogni anno per appuntamenti saltati" },
  { value: 67, suffix: "%", prefix: "", label: "Dei no-show ha semplicemente dimenticato l'appuntamento" },
] as const;

export const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Collega il Tuo Calendario",
    description: "Integra il tuo sistema di prenotazione esistente tramite la nostra API o usa la dashboard integrata. Configurazione in meno di 15 minuti.",
    icon: "CalendarSync",
  },
  {
    step: 2,
    title: "Ricordiamo ai Tuoi Clienti",
    description: "Promemoria intelligenti multi-canale via WhatsApp, SMS ed email — con tempistiche perfette basate sull'analisi IA del comportamento dei clienti.",
    icon: "Bell",
  },
  {
    step: 3,
    title: "Gli Slot Vuoti si Riempiono",
    description: "Quando qualcuno cancella, la lista d'attesa con IA trova istantaneamente il miglior sostituto — valutando urgenza, affidabilità e preferenze.",
    icon: "UserCheck",
  },
] as const;

export const FEATURES = [
  {
    title: "Promemoria Intelligenti",
    description: "Promemoria con tempistiche IA via WhatsApp, SMS ed email che riducono i no-show fino all'80%.",
    icon: "Bell",
  },
  {
    title: "Lista d'Attesa IA",
    description: "Riempimento automatico degli slot cancellati valutando i clienti in lista d'attesa per urgenza, affidabilità e preferenze.",
    icon: "ListChecks",
  },
  {
    title: "Ottimizzazione Calendario",
    description: "L'IA analizza il tuo programma per ridurre i buchi, raggruppare gli appuntamenti e massimizzare la produttività giornaliera.",
    icon: "CalendarDays",
  },
  {
    title: "Dashboard in Tempo Reale",
    description: "Monitora tassi di no-show, fatturato recuperato, performance della lista d'attesa e trend a colpo d'occhio.",
    icon: "LayoutDashboard",
  },
  {
    title: "Multi-sede",
    description: "Gestisci più sedi da un unico account con statistiche per sede e permessi del team.",
    icon: "MapPin",
  },
  {
    title: "API per Sviluppatori",
    description: "API REST con webhooks per un'integrazione perfetta con qualsiasi sistema gestionale o EHR.",
    icon: "Code",
  },
] as const;
