/**
 * AI Morning Briefing Generator
 *
 * Generates a daily Italian briefing for clinic staff using Claude Sonnet.
 * Collects today's KPIs, high-risk appointments, pending confirmations,
 * active cascade offers, and recent recovery trends, then asks Claude to
 * produce a concise actionable summary.
 *
 * Cached in-memory: regenerated at most once per hour.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MorningBriefingData {
  readonly todayCount: number;
  readonly pendingConfirmations: number;
  readonly highRiskCount: number;
  readonly highRiskPatients: readonly HighRiskPatient[];
  readonly activeOfferCount: number;
  readonly yesterdayNoShows: number;
  readonly yesterdayRecoveries: number;
  readonly yesterdayRevenueSaved: number;
  readonly thisWeekAppointments: number;
  readonly lastWeekAppointments: number;
}

export interface HighRiskPatient {
  readonly name: string;
  readonly service: string;
  readonly scheduledAt: string;
  readonly riskScore: number;
}

export interface MorningBriefingResult {
  readonly briefing: string;
  readonly generatedAt: string;
  readonly data: MorningBriefingData;
}

// ---------------------------------------------------------------------------
// In-memory cache (per tenantId + date)
// ---------------------------------------------------------------------------

interface CacheEntry {
  readonly result: MorningBriefingResult;
  readonly cachedAt: number; // Unix ms
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const briefingCache = new Map<string, CacheEntry>();

function cacheKey(tenantId: string, date: string): string {
  return `${tenantId}::${date}`;
}

function getCached(tenantId: string, date: string): MorningBriefingResult | null {
  const entry = briefingCache.get(cacheKey(tenantId, date));
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    briefingCache.delete(cacheKey(tenantId, date));
    return null;
  }
  return entry.result;
}

function setCached(tenantId: string, date: string, result: MorningBriefingResult): void {
  briefingCache.set(cacheKey(tenantId, date), { result, cachedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Data gathering
// ---------------------------------------------------------------------------

async function gatherBriefingData(
  supabase: SupabaseClient,
  tenantId: string,
  date: string // YYYY-MM-DD
): Promise<MorningBriefingData> {
  const todayStart = `${date}T00:00:00.000Z`;
  const todayEnd = `${date}T23:59:59.999Z`;

  // Yesterday
  const yesterdayDate = new Date(date);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yd = yesterdayDate.toISOString().slice(0, 10);
  const yesterdayStart = `${yd}T00:00:00.000Z`;
  const yesterdayEnd = `${yd}T23:59:59.999Z`;

  // This week (Mon–today) and same 7-day window last week
  const now = new Date(`${date}T12:00:00.000Z`);
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysFromMonday);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const lastWeekEnd = new Date(weekStart);
  lastWeekEnd.setUTCDate(weekStart.getUTCDate() - 1);

  const [
    todayRes,
    pendingRes,
    highRiskRes,
    activeOffersRes,
    yesterdayNoShowRes,
    yesterdayRecoveryRes,
    thisWeekRes,
    lastWeekRes,
    tenantRes,
  ] = await Promise.all([
    // Today's total appointments (non-terminal)
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", todayStart)
      .lte("scheduled_at", todayEnd)
      .not("status", "in", "(declined,cancelled,timeout)"),

    // Pending confirmations (today + tomorrow)
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["scheduled", "reminder_pending", "reminder_sent"])
      .gte("scheduled_at", todayStart),

    // High-risk appointments today (risk_score >= 50)
    supabase
      .from("appointments")
      .select("id, service_name, scheduled_at, risk_score, patient:patients(first_name, last_name)")
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", todayStart)
      .lte("scheduled_at", todayEnd)
      .not("status", "in", "(declined,cancelled,timeout,completed,no_show)")
      .gte("risk_score", 50)
      .order("risk_score", { ascending: false })
      .limit(10),

    // Active cascade offers (pending, not expired)
    supabase
      .from("waitlist_offers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .gte("expires_at", new Date().toISOString()),

    // Yesterday no-shows
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "no_show")
      .gte("scheduled_at", yesterdayStart)
      .lte("scheduled_at", yesterdayEnd),

    // Yesterday accepted recoveries with new appointment
    supabase
      .from("waitlist_offers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "accepted")
      .not("new_appointment_id", "is", null)
      .gte("responded_at", yesterdayStart)
      .lte("responded_at", yesterdayEnd),

    // This week appointments
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", weekStart.toISOString())
      .lte("scheduled_at", todayEnd)
      .not("status", "in", "(declined,cancelled,timeout)"),

    // Last week appointments (same window)
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", lastWeekStart.toISOString())
      .lte("scheduled_at", lastWeekEnd.toISOString())
      .not("status", "in", "(declined,cancelled,timeout)"),

    // Tenant avg appointment value for revenue calc
    supabase
      .from("tenants")
      .select("avg_appointment_value")
      .eq("id", tenantId)
      .single(),
  ]);

  const avgValue = tenantRes.data?.avg_appointment_value ?? 80;
  const yesterdayRecoveries = yesterdayRecoveryRes.count ?? 0;

  const highRiskPatients: HighRiskPatient[] = (highRiskRes.data ?? []).map((appt) => {
    const p = appt.patient as unknown as { first_name: string; last_name: string } | null;
    return {
      name: p ? `${p.first_name} ${p.last_name}` : "Paziente",
      service: appt.service_name ?? "Servizio",
      scheduledAt: appt.scheduled_at,
      riskScore: appt.risk_score ?? 0,
    };
  });

  return {
    todayCount: todayRes.count ?? 0,
    pendingConfirmations: pendingRes.count ?? 0,
    highRiskCount: highRiskPatients.length,
    highRiskPatients,
    activeOfferCount: activeOffersRes.count ?? 0,
    yesterdayNoShows: yesterdayNoShowRes.count ?? 0,
    yesterdayRecoveries,
    yesterdayRevenueSaved: yesterdayRecoveries * avgValue,
    thisWeekAppointments: thisWeekRes.count ?? 0,
    lastWeekAppointments: lastWeekRes.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// AI briefing generation
// ---------------------------------------------------------------------------

function buildFallbackBriefing(data: MorningBriefingData, date: string): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  const dateStr = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

  const lines: string[] = [
    `Buongiorno! Oggi, ${dateStr}, ci sono ${data.todayCount} appuntamenti in agenda.`,
  ];

  if (data.pendingConfirmations > 0) {
    lines.push(`${data.pendingConfirmations} appuntamenti sono ancora in attesa di conferma.`);
  }

  if (data.highRiskCount > 0) {
    lines.push(`Attenzione: ${data.highRiskCount} appuntamenti ad alto rischio richiedono monitoraggio.`);
  }

  if (data.activeOfferCount > 0) {
    lines.push(`Cascade attivo: ${data.activeOfferCount} offerte in corso.`);
  }

  if (data.yesterdayNoShows > 0 || data.yesterdayRecoveries > 0) {
    lines.push(
      `Ieri: ${data.yesterdayNoShows} no-show, ${data.yesterdayRecoveries} slot recuperati (€${data.yesterdayRevenueSaved} ricuperati).`
    );
  }

  return lines.join(" ");
}

async function generateAIBriefing(data: MorningBriefingData, date: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallbackBriefing(data, date);
  }

  const d = new Date(`${date}T12:00:00.000Z`);
  const dateStr = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

  const weekTrend =
    data.lastWeekAppointments > 0
      ? Math.round(((data.thisWeekAppointments - data.lastWeekAppointments) / data.lastWeekAppointments) * 100)
      : 0;

  const highRiskList = data.highRiskPatients
    .slice(0, 5)
    .map(
      (p) =>
        `- ${p.name} (${p.service}, ${new Date(p.scheduledAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}, rischio ${p.riskScore}/100)`
    )
    .join("\n");

  const prompt = `Sei l'assistente AI per una clinica medica/estetica. Genera il briefing del mattino in italiano per il personale. Sii conciso, pratico e metti in evidenza cosa richiede attenzione.

Data: ${dateStr}

DATI DEL GIORNO:
- Appuntamenti oggi: ${data.todayCount}
- In attesa di conferma: ${data.pendingConfirmations}
- Ad alto rischio (score >= 50): ${data.highRiskCount}
${highRiskList ? `\nPazienti ad alto rischio:\n${highRiskList}` : ""}

CASCADE ATTIVO:
- Offerte in corso: ${data.activeOfferCount}

IERI:
- No-show: ${data.yesterdayNoShows}
- Slot recuperati: ${data.yesterdayRecoveries}
- Ricavo recuperato: €${data.yesterdayRevenueSaved}

TREND SETTIMANA:
- Questa settimana (fino a oggi): ${data.thisWeekAppointments} appuntamenti
- Settimana scorsa (stesso periodo): ${data.lastWeekAppointments} appuntamenti
- Variazione: ${weekTrend >= 0 ? "+" : ""}${weekTrend}%

FORMATO RISPOSTA (segui esattamente questa struttura, max 300 parole):
1. **Buongiorno** — una frase con i numeri chiave del giorno
2. **Attenzione** — pazienti ad alto rischio che il sistema sta monitorando (se ce ne sono)
3. **Cascade** — situazione offerte attive (se applicabile)
4. **Ieri** — performance di ieri in una frase
5. **Azioni AI** — cosa il sistema sta facendo o farà automaticamente (es. invio promemoria, contatto pazienti in attesa, attivazione offerte cascade). NON suggerire mai azioni manuali all'operatore: il sistema è autonomo.

Rispondi SOLO con il briefing in italiano. Nessun JSON, nessun markdown oltre al grassetto per i titoli delle sezioni.`;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ timeout: 15_000 });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text" || !content.text.trim()) {
      return buildFallbackBriefing(data, date);
    }

    return content.text.trim();
  } catch (err) {
    console.error("[MorningBriefing] AI generation failed:", err);
    return buildFallbackBriefing(data, date);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate (or return cached) morning briefing for a tenant on a given date.
 *
 * @param supabase  Supabase client
 * @param tenantId  Tenant ID
 * @param date      Date in YYYY-MM-DD format (defaults to today UTC)
 * @param forceRefresh  Skip cache and regenerate
 */
export async function generateMorningBriefing(
  supabase: SupabaseClient,
  tenantId: string,
  date?: string,
  forceRefresh = false
): Promise<MorningBriefingResult> {
  const effectiveDate = date ?? new Date().toISOString().slice(0, 10);

  if (!forceRefresh) {
    const cached = getCached(tenantId, effectiveDate);
    if (cached) return cached;
  }

  const data = await gatherBriefingData(supabase, tenantId, effectiveDate);
  const briefing = await generateAIBriefing(data, effectiveDate);

  const result: MorningBriefingResult = {
    briefing,
    generatedAt: new Date().toISOString(),
    data,
  };

  setCached(tenantId, effectiveDate, result);
  return result;
}
