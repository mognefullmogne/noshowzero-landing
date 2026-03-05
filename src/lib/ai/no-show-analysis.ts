// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * No-Show Root Cause Analysis
 *
 * Analyzes appointment patterns over the last 90 days for a tenant
 * and uses Claude Sonnet to produce actionable Italian-language insights
 * about why no-shows are happening and what to do about them.
 *
 * Results are cached in-memory for 24 hours per tenant to avoid
 * redundant AI calls.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoShowAggregates {
  readonly totalAppointments: number;
  readonly totalNoShows: number;
  readonly overallNoShowRate: number;

  /** No-show rate (%) by day of week (0=Sun…6=Sat) */
  readonly byDayOfWeek: readonly DayStats[];

  /** No-show rate (%) by hour of day (0-23) */
  readonly byHourOfDay: readonly HourStats[];

  /** No-show rate (%) by provider — only populated if > 1 provider exists */
  readonly byProvider: readonly ProviderStats[];

  /** No-show rate (%) by service type */
  readonly byServiceType: readonly ServiceStats[];

  /** No-show rate (%) by lead time bucket (days between booking and appt) */
  readonly byLeadTime: readonly LeadTimeStats[];

  /** Patients with 3+ no-shows */
  readonly repeatOffenders: readonly RepeatOffender[];
}

export interface DayStats {
  readonly dayOfWeek: number;   // 0=Sun…6=Sat
  readonly dayName: string;     // Italian day name
  readonly total: number;
  readonly noShows: number;
  readonly rate: number;        // percentage 0-100
}

export interface HourStats {
  readonly hour: number;        // 0-23
  readonly label: string;       // e.g. "09:00-10:00"
  readonly total: number;
  readonly noShows: number;
  readonly rate: number;
}

export interface ProviderStats {
  readonly provider: string;
  readonly total: number;
  readonly noShows: number;
  readonly rate: number;
}

export interface ServiceStats {
  readonly service: string;
  readonly total: number;
  readonly noShows: number;
  readonly rate: number;
}

export interface LeadTimeStats {
  readonly bucket: string;      // e.g. "0-3 giorni", "4-7 giorni"
  readonly minDays: number;
  readonly maxDays: number;
  readonly total: number;
  readonly noShows: number;
  readonly rate: number;
}

export interface RepeatOffender {
  readonly patientId: string;
  readonly patientName: string;
  readonly noShowCount: number;
  readonly totalAppointments: number;
  readonly rate: number;
}

export interface NoShowAnalysisResult {
  readonly analysis: string;        // AI-generated Italian text
  readonly data: NoShowAggregates;  // raw aggregates
  readonly generatedAt: string;     // ISO 8601
}

// ---------------------------------------------------------------------------
// In-memory cache (24-hour TTL per tenant)
// ---------------------------------------------------------------------------

interface CacheEntry {
  readonly result: NoShowAnalysisResult;
  readonly expiresAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const analysisCache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Lead time buckets
// ---------------------------------------------------------------------------

const LEAD_TIME_BUCKETS: readonly { bucket: string; minDays: number; maxDays: number }[] = [
  { bucket: "Stesso giorno", minDays: 0, maxDays: 0 },
  { bucket: "1-3 giorni", minDays: 1, maxDays: 3 },
  { bucket: "4-7 giorni", minDays: 4, maxDays: 7 },
  { bucket: "8-14 giorni", minDays: 8, maxDays: 14 },
  { bucket: "15-30 giorni", minDays: 15, maxDays: 30 },
  { bucket: "31+ giorni", minDays: 31, maxDays: Infinity },
];

const ITALIAN_DAY_NAMES = [
  "Domenica", "Lunedi", "Martedi", "Mercoledi",
  "Giovedi", "Venerdi", "Sabato",
];

// ---------------------------------------------------------------------------
// analyzeNoShowPatterns
// ---------------------------------------------------------------------------

/**
 * Analyze no-show patterns for a tenant over the last 90 days.
 * Returns cached result if available and not expired.
 *
 * Uses Claude Sonnet for the final analysis (more reasoning power for insights).
 */
export async function analyzeNoShowPatterns(
  supabase: SupabaseClient,
  tenantId: string
): Promise<NoShowAnalysisResult> {
  // Check cache
  const cached = analysisCache.get(tenantId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  // Compute aggregates from DB
  const aggregates = await computeAggregates(supabase, tenantId);

  // Generate AI analysis
  const analysis = await generateAnalysis(aggregates);

  const result: NoShowAnalysisResult = {
    analysis,
    data: aggregates,
    generatedAt: new Date().toISOString(),
  };

  // Store in cache
  analysisCache.set(tenantId, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return result;
}

/**
 * Invalidate the cached analysis for a tenant.
 * Called when the "Aggiorna analisi" button is clicked.
 */
export function invalidateAnalysisCache(tenantId: string): void {
  analysisCache.delete(tenantId);
}

// ---------------------------------------------------------------------------
// Aggregate computation
// ---------------------------------------------------------------------------

interface RawAppointment {
  readonly id: string;
  readonly patient_id: string;
  readonly provider_name: string | null;
  readonly service_name: string;
  readonly scheduled_at: string;
  readonly created_at: string;
  readonly status: string;
}

async function computeAggregates(
  supabase: SupabaseClient,
  tenantId: string
): Promise<NoShowAggregates> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data, error } = await supabase
    .from("appointments")
    .select("id, patient_id, provider_name, service_name, scheduled_at, created_at, status")
    .eq("tenant_id", tenantId)
    .gte("scheduled_at", since.toISOString())
    .in("status", ["completed", "no_show", "cancelled", "confirmed", "declined"])
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("[NoShowAnalysis] Failed to fetch appointments:", error);
    return buildEmptyAggregates();
  }

  const appointments: readonly RawAppointment[] = data ?? [];
  const total = appointments.length;
  const noShowCount = appointments.filter((a) => a.status === "no_show").length;
  const overallRate = total > 0 ? Math.round((noShowCount / total) * 100) : 0;

  return {
    totalAppointments: total,
    totalNoShows: noShowCount,
    overallNoShowRate: overallRate,
    byDayOfWeek: computeByDayOfWeek(appointments),
    byHourOfDay: computeByHourOfDay(appointments),
    byProvider: computeByProvider(appointments),
    byServiceType: computeByServiceType(appointments),
    byLeadTime: computeByLeadTime(appointments),
    repeatOffenders: await computeRepeatOffenders(supabase, tenantId, appointments),
  };
}

function buildEmptyAggregates(): NoShowAggregates {
  return {
    totalAppointments: 0,
    totalNoShows: 0,
    overallNoShowRate: 0,
    byDayOfWeek: [],
    byHourOfDay: [],
    byProvider: [],
    byServiceType: [],
    byLeadTime: [],
    repeatOffenders: [],
  };
}

function computeByDayOfWeek(appointments: readonly RawAppointment[]): readonly DayStats[] {
  const counts = new Map<number, { total: number; noShows: number }>();

  for (const appt of appointments) {
    const dow = new Date(appt.scheduled_at).getDay();
    const prev = counts.get(dow) ?? { total: 0, noShows: 0 };
    counts.set(dow, {
      total: prev.total + 1,
      noShows: prev.noShows + (appt.status === "no_show" ? 1 : 0),
    });
  }

  const result: DayStats[] = [];
  for (let i = 0; i <= 6; i++) {
    const stats = counts.get(i);
    if (!stats) continue;
    result.push({
      dayOfWeek: i,
      dayName: ITALIAN_DAY_NAMES[i],
      total: stats.total,
      noShows: stats.noShows,
      rate: stats.total > 0 ? Math.round((stats.noShows / stats.total) * 100) : 0,
    });
  }
  return result;
}

function computeByHourOfDay(appointments: readonly RawAppointment[]): readonly HourStats[] {
  const counts = new Map<number, { total: number; noShows: number }>();

  for (const appt of appointments) {
    const hour = new Date(appt.scheduled_at).getHours();
    const prev = counts.get(hour) ?? { total: 0, noShows: 0 };
    counts.set(hour, {
      total: prev.total + 1,
      noShows: prev.noShows + (appt.status === "no_show" ? 1 : 0),
    });
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, stats]) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00-${String(hour + 1).padStart(2, "0")}:00`,
      total: stats.total,
      noShows: stats.noShows,
      rate: stats.total > 0 ? Math.round((stats.noShows / stats.total) * 100) : 0,
    }));
}

function computeByProvider(appointments: readonly RawAppointment[]): readonly ProviderStats[] {
  const counts = new Map<string, { total: number; noShows: number }>();

  for (const appt of appointments) {
    const provider = appt.provider_name ?? "Non specificato";
    const prev = counts.get(provider) ?? { total: 0, noShows: 0 };
    counts.set(provider, {
      total: prev.total + 1,
      noShows: prev.noShows + (appt.status === "no_show" ? 1 : 0),
    });
  }

  // Only return if multiple providers exist (single provider = not meaningful)
  if (counts.size <= 1) return [];

  return [...counts.entries()]
    .map(([provider, stats]) => ({
      provider,
      total: stats.total,
      noShows: stats.noShows,
      rate: stats.total > 0 ? Math.round((stats.noShows / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.noShows - a.noShows);
}

function computeByServiceType(appointments: readonly RawAppointment[]): readonly ServiceStats[] {
  const counts = new Map<string, { total: number; noShows: number }>();

  for (const appt of appointments) {
    const service = appt.service_name || "Altro";
    const prev = counts.get(service) ?? { total: 0, noShows: 0 };
    counts.set(service, {
      total: prev.total + 1,
      noShows: prev.noShows + (appt.status === "no_show" ? 1 : 0),
    });
  }

  return [...counts.entries()]
    .map(([service, stats]) => ({
      service,
      total: stats.total,
      noShows: stats.noShows,
      rate: stats.total > 0 ? Math.round((stats.noShows / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.noShows - a.noShows);
}

function computeByLeadTime(appointments: readonly RawAppointment[]): readonly LeadTimeStats[] {
  const bucketCounts = new Map<string, { total: number; noShows: number; minDays: number; maxDays: number }>();

  // Initialize all buckets
  for (const b of LEAD_TIME_BUCKETS) {
    bucketCounts.set(b.bucket, { total: 0, noShows: 0, minDays: b.minDays, maxDays: b.maxDays });
  }

  for (const appt of appointments) {
    const scheduled = new Date(appt.scheduled_at).getTime();
    const created = new Date(appt.created_at).getTime();
    const leadDays = Math.max(0, Math.round((scheduled - created) / (1000 * 60 * 60 * 24)));

    const bucket = LEAD_TIME_BUCKETS.find(
      (b) => leadDays >= b.minDays && leadDays <= b.maxDays
    );
    if (!bucket) continue;

    const prev = bucketCounts.get(bucket.bucket) ?? { total: 0, noShows: 0, minDays: bucket.minDays, maxDays: bucket.maxDays };
    bucketCounts.set(bucket.bucket, {
      ...prev,
      total: prev.total + 1,
      noShows: prev.noShows + (appt.status === "no_show" ? 1 : 0),
    });
  }

  return [...bucketCounts.entries()]
    .filter(([, stats]) => stats.total > 0)
    .map(([bucket, stats]) => ({
      bucket,
      minDays: stats.minDays,
      maxDays: stats.maxDays,
      total: stats.total,
      noShows: stats.noShows,
      rate: Math.round((stats.noShows / stats.total) * 100),
    }));
}

async function computeRepeatOffenders(
  supabase: SupabaseClient,
  tenantId: string,
  appointments: readonly RawAppointment[]
): Promise<readonly RepeatOffender[]> {
  // Count no-shows per patient from the 90-day window
  const patientNoShows = new Map<string, number>();
  const patientTotal = new Map<string, number>();

  for (const appt of appointments) {
    const prev = patientTotal.get(appt.patient_id) ?? 0;
    patientTotal.set(appt.patient_id, prev + 1);
    if (appt.status === "no_show") {
      const prevNs = patientNoShows.get(appt.patient_id) ?? 0;
      patientNoShows.set(appt.patient_id, prevNs + 1);
    }
  }

  // Find patients with 3+ no-shows
  const offenderIds = [...patientNoShows.entries()]
    .filter(([, count]) => count >= 3)
    .map(([id]) => id);

  if (offenderIds.length === 0) return [];

  // Fetch patient names
  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name")
    .eq("tenant_id", tenantId)
    .in("id", offenderIds);

  const nameMap = new Map<string, string>();
  for (const p of patients ?? []) {
    nameMap.set(p.id, `${p.first_name} ${p.last_name}`);
  }

  return offenderIds
    .map((id) => {
      const noShows = patientNoShows.get(id) ?? 0;
      const total = patientTotal.get(id) ?? 0;
      return {
        patientId: id,
        patientName: nameMap.get(id) ?? "Paziente",
        noShowCount: noShows,
        totalAppointments: total,
        rate: total > 0 ? Math.round((noShows / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.noShowCount - a.noShowCount);
}

// ---------------------------------------------------------------------------
// AI analysis generation
// ---------------------------------------------------------------------------

async function generateAnalysis(aggregates: NoShowAggregates): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateFallbackAnalysis(aggregates);
  }

  if (aggregates.totalAppointments === 0) {
    return "Nessun dato disponibile per l'analisi. Aggiungi appuntamenti per vedere i pattern.";
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ timeout: 30_000 });

    const statsText = formatAggregatesForPrompt(aggregates);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: `Sei un esperto di analytics per cliniche mediche italiane. Il tuo compito è analizzare i dati di no-show e produrre insights azionabili.

Formatta la risposta in markdown con queste sezioni:
## Le cause principali
Elenca le top 3 cause radice con i dati specifici.

## Pazienti a rischio
Analizza i pazienti cronici no-show e suggerisci azioni concrete per ciascuno.

## Pattern temporali
Identifica i giorni/orari ad alto rischio e spiega il possibile motivo.

## Raccomandazioni
Fornisci 3 raccomandazioni specifiche e azionabili, con impatto atteso.

Usa sempre i numeri specifici dai dati. Scrivi in italiano professionale ma comprensibile.`,
      messages: [
        {
          role: "user",
          content: `Analizza questi dati di no-show degli ultimi 90 giorni:\n\n${statsText}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return generateFallbackAnalysis(aggregates);
    }

    return content.text.trim();
  } catch (err) {
    console.error("[NoShowAnalysis] AI generation failed:", err);
    return generateFallbackAnalysis(aggregates);
  }
}

/** Format aggregates into a readable text block for the AI prompt. */
function formatAggregatesForPrompt(agg: NoShowAggregates): string {
  const lines: string[] = [
    `RIEPILOGO GENERALE:`,
    `- Totale appuntamenti (90 giorni): ${agg.totalAppointments}`,
    `- Totale no-show: ${agg.totalNoShows} (${agg.overallNoShowRate}%)`,
    ``,
    `NO-SHOW PER GIORNO DELLA SETTIMANA:`,
  ];

  for (const d of agg.byDayOfWeek) {
    if (d.total > 0) {
      lines.push(`- ${d.dayName}: ${d.noShows}/${d.total} (${d.rate}%)`);
    }
  }

  lines.push(``, `NO-SHOW PER FASCIA ORARIA (solo fasce con dati):`);
  for (const h of agg.byHourOfDay.filter((h) => h.total >= 3)) {
    lines.push(`- ${h.label}: ${h.noShows}/${h.total} (${h.rate}%)`);
  }

  if (agg.byProvider.length > 0) {
    lines.push(``, `NO-SHOW PER DOTTORE:`);
    for (const p of agg.byProvider) {
      lines.push(`- ${p.provider}: ${p.noShows}/${p.total} (${p.rate}%)`);
    }
  }

  if (agg.byServiceType.length > 0) {
    lines.push(``, `NO-SHOW PER TIPO DI SERVIZIO:`);
    for (const s of agg.byServiceType.slice(0, 10)) {
      lines.push(`- ${s.service}: ${s.noShows}/${s.total} (${s.rate}%)`);
    }
  }

  lines.push(``, `NO-SHOW PER ANTICIPO PRENOTAZIONE:`);
  for (const lt of agg.byLeadTime) {
    lines.push(`- ${lt.bucket}: ${lt.noShows}/${lt.total} (${lt.rate}%)`);
  }

  if (agg.repeatOffenders.length > 0) {
    lines.push(``, `PAZIENTI CRONICI NO-SHOW (3+ no-show in 90 giorni):`);
    for (const r of agg.repeatOffenders.slice(0, 10)) {
      lines.push(`- ${r.patientName}: ${r.noShowCount} no-show su ${r.totalAppointments} appuntamenti (${r.rate}%)`);
    }
  } else {
    lines.push(``, `PAZIENTI CRONICI: Nessun paziente con 3+ no-show nel periodo.`);
  }

  return lines.join("\n");
}

/** Deterministic fallback when ANTHROPIC_API_KEY is not set. */
function generateFallbackAnalysis(agg: NoShowAggregates): string {
  if (agg.totalAppointments === 0) {
    return "Nessun dato disponibile per l'analisi.";
  }

  const worstDay = [...agg.byDayOfWeek].sort((a, b) => b.rate - a.rate)[0];
  const worstHour = [...agg.byHourOfDay].sort((a, b) => b.rate - a.rate)[0];

  const lines = [
    `## Riepilogo`,
    `Tasso no-show generale: **${agg.overallNoShowRate}%** (${agg.totalNoShows} su ${agg.totalAppointments} appuntamenti negli ultimi 90 giorni).`,
  ];

  if (worstDay) {
    lines.push(`\n## Pattern temporali`, `Il giorno con il tasso più alto è **${worstDay.dayName}** (${worstDay.rate}%).`);
  }
  if (worstHour) {
    lines.push(`La fascia oraria più problematica è **${worstHour.label}** (${worstHour.rate}%).`);
  }

  if (agg.repeatOffenders.length > 0) {
    lines.push(`\n## Pazienti a rischio`, `${agg.repeatOffenders.length} pazienti hanno 3 o più no-show. Considerare un follow-up personalizzato.`);
  }

  lines.push(`\n## Raccomandazioni`, `1. Inviare reminder più frequenti per gli appuntamenti nei giorni/orari ad alto rischio.`, `2. Contattare telefonicamente i pazienti cronici no-show prima degli appuntamenti.`, `3. Considerare un sistema di conferma obbligatoria per gli slot a rischio.`);

  return lines.join("\n");
}
