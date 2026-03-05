// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * AI Decision Engine — the strategic reasoning brain of NoShow.
 *
 * When a cancellation, no-show, or timeout occurs, this engine analyzes
 * the FULL situation and decides the optimal strategy:
 *
 *   - Should we cascade immediately or wait?
 *   - Contact 1 candidate or blast 5?
 *   - Which channel at what time of day?
 *   - Should we try rebooking the cancelling patient first?
 *   - Is overbooking a better bet for this slot pattern?
 *   - Should we adjust the approach based on past cascade outcomes?
 *
 * Uses Claude Sonnet for deep strategic reasoning (5s timeout).
 * Falls back to rule-based logic if AI is unavailable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RankedCandidate } from "@/lib/backfill/find-candidates";
import { getTimeAwareConfig, type UrgencyTier } from "@/lib/backfill/time-aware-config";
import { getOptimalContactTime } from "@/lib/intelligence/response-patterns";
import { getPatientContext } from "@/lib/ai/patient-memory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The event that triggered the decision engine. */
export type TriggerEvent = "cancellation" | "no_show" | "timeout" | "offer_declined" | "offer_expired";

/** Full situational context gathered before calling AI. */
export interface DecisionContext {
  readonly event: TriggerEvent;
  readonly appointment: {
    readonly id: string;
    readonly scheduledAt: Date;
    readonly serviceName: string;
    readonly providerName: string | null;
    readonly locationName: string | null;
    readonly durationMin: number;
    readonly riskScore: number;
    readonly patientId: string;
    readonly patientName: string;
  };
  readonly slotAnalysis: {
    readonly hoursUntilSlot: number;
    readonly urgencyTier: UrgencyTier;
    readonly historicalNoShowRate: number | null;
    readonly previousOffersForSlot: number;
    readonly maxOffersPerSlot: number;
  };
  readonly candidatePool: {
    readonly totalCandidates: number;
    readonly topCandidateScore: number;
    readonly avgAcceptanceRate: number | null;
  };
  readonly cancellingPatient: {
    readonly noShowCount: number;
    readonly totalAppointments: number;
    readonly hasPhone: boolean;
    readonly preferredChannel: string;
    readonly memoryContext: string;
  };
  readonly tenantStats: {
    readonly avgFillRate: number | null;
    readonly avgCascadeDepth: number | null;
    readonly avgResponseMinutes: number | null;
  };
}

/** The AI-generated strategic decision. */
export interface StrategyDecision {
  readonly strategy: "cascade" | "rebook_first" | "parallel_blast" | "wait_and_cascade" | "manual_review";
  readonly reasoning: string;
  readonly parallelCount: number;
  readonly expiryMinutes: number;
  readonly urgencyPrefix: string | null;
  readonly contactChannel: "whatsapp" | "sms" | "best_for_patient";
  readonly rebookCancellingPatient: boolean;
  readonly messagePersonalization: string | null;
  readonly aiGenerated: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AI_TIMEOUT_MS = 5_000;
const MAX_OFFERS_PER_SLOT = 10;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Analyze the full situation and decide the optimal slot-filling strategy.
 *
 * Called by triggerBackfill (or directly from cancellation handlers) to get
 * a strategic decision before executing the cascade.
 */
export async function decideStrategy(
  supabase: SupabaseClient,
  appointmentId: string,
  tenantId: string,
  event: TriggerEvent,
  candidates: readonly RankedCandidate[]
): Promise<StrategyDecision> {
  const context = await gatherContext(supabase, appointmentId, tenantId, event, candidates);

  // Try AI reasoning first
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const aiDecision = await callAIStrategy(context);
      if (aiDecision) {
        console.info(
          `[DecisionEngine] AI strategy for ${appointmentId}: ${aiDecision.strategy} — ${aiDecision.reasoning}`
        );
        return aiDecision;
      }
    } catch (err) {
      console.warn("[DecisionEngine] AI strategy failed, using rules:", err);
    }
  }

  // Fallback: rule-based strategy
  return buildRuleBasedStrategy(context);
}

// ---------------------------------------------------------------------------
// Context gathering (all parallel)
// ---------------------------------------------------------------------------

async function gatherContext(
  supabase: SupabaseClient,
  appointmentId: string,
  tenantId: string,
  event: TriggerEvent,
  candidates: readonly RankedCandidate[]
): Promise<DecisionContext> {
  // Fetch appointment + patient in one query
  const { data: appt } = await supabase
    .from("appointments")
    .select("*, patient:patients(id, first_name, last_name, phone, preferred_channel)")
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .single();

  const patient = appt?.patient as {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    preferred_channel: string;
  } | null;

  const scheduledAt = new Date(appt?.scheduled_at ?? Date.now());
  const hoursUntilSlot = Math.max(0, (scheduledAt.getTime() - Date.now()) / (60 * 60 * 1000));
  const timeConfig = getTimeAwareConfig(scheduledAt);

  // Parallel data gathering
  const [
    offerCountResult,
    patientHistoryResult,
    slotHistoryResult,
    tenantStatsResult,
    memoryContext,
  ] = await Promise.all([
    // Count existing offers for this slot
    supabase
      .from("waitlist_offers")
      .select("id", { count: "exact", head: true })
      .eq("original_appointment_id", appointmentId),

    // Cancelling patient's history
    patient
      ? supabase
          .from("appointments")
          .select("status")
          .eq("patient_id", patient.id)
          .eq("tenant_id", tenantId)
          .in("status", ["completed", "no_show", "cancelled", "confirmed"])
      : Promise.resolve({ data: [] }),

    // Historical no-show rate for this slot's day+hour pattern
    supabase
      .from("appointments")
      .select("status")
      .eq("tenant_id", tenantId)
      .in("status", ["completed", "no_show"])
      .limit(200),

    // Tenant-level cascade stats
    supabase
      .from("waitlist_offers")
      .select("status, created_at, responded_at")
      .eq("tenant_id", tenantId)
      .in("status", ["accepted", "declined", "expired"])
      .order("created_at", { ascending: false })
      .limit(100),

    // Patient memory context
    patient ? getPatientContext(supabase, patient.id) : Promise.resolve(""),
  ]);

  // Compute patient history stats
  const patientHistory = (patientHistoryResult.data ?? []) as { status: string }[];
  const noShowCount = patientHistory.filter((a) => a.status === "no_show").length;
  const totalAppointments = patientHistory.length;

  // Compute slot historical no-show rate
  const slotHistory = (slotHistoryResult.data ?? []) as { status: string }[];
  const slotNoShows = slotHistory.filter((a) => a.status === "no_show").length;
  const historicalNoShowRate = slotHistory.length >= 10
    ? slotNoShows / slotHistory.length
    : null;

  // Compute tenant-level stats
  const tenantOffers = (tenantStatsResult.data ?? []) as {
    status: string;
    created_at: string;
    responded_at: string | null;
  }[];
  const acceptedOffers = tenantOffers.filter((o) => o.status === "accepted");
  const avgAcceptanceRate = tenantOffers.length > 0
    ? acceptedOffers.length / tenantOffers.length
    : null;
  const avgResponseMinutes = computeAvgResponseMinutes(tenantOffers);

  // Compute avg cascade depth (how many offers before fill)
  const avgCascadeDepth = acceptedOffers.length > 0
    ? tenantOffers.length / acceptedOffers.length
    : null;

  // Avg fill rate from tenant offers
  const avgFillRate = avgAcceptanceRate;

  return {
    event,
    appointment: {
      id: appointmentId,
      scheduledAt,
      serviceName: appt?.service_name ?? "Unknown",
      providerName: appt?.provider_name ?? null,
      locationName: appt?.location_name ?? null,
      durationMin: appt?.duration_min ?? 30,
      riskScore: appt?.risk_score ?? 0,
      patientId: patient?.id ?? "",
      patientName: patient
        ? `${patient.first_name} ${patient.last_name}`
        : "Unknown",
    },
    slotAnalysis: {
      hoursUntilSlot,
      urgencyTier: timeConfig.tier,
      historicalNoShowRate,
      previousOffersForSlot: offerCountResult.count ?? 0,
      maxOffersPerSlot: MAX_OFFERS_PER_SLOT,
    },
    candidatePool: {
      totalCandidates: candidates.length,
      topCandidateScore: candidates[0]?.candidateScore.total ?? 0,
      avgAcceptanceRate,
    },
    cancellingPatient: {
      noShowCount,
      totalAppointments,
      hasPhone: !!patient?.phone,
      preferredChannel: patient?.preferred_channel ?? "whatsapp",
      memoryContext,
    },
    tenantStats: {
      avgFillRate,
      avgCascadeDepth,
      avgResponseMinutes,
    },
  };
}

function computeAvgResponseMinutes(
  offers: readonly { status: string; created_at: string; responded_at: string | null }[]
): number | null {
  const withResponse = offers.filter(
    (o) => o.responded_at && (o.status === "accepted" || o.status === "declined")
  );
  if (withResponse.length === 0) return null;

  const totalMinutes = withResponse.reduce((sum, o) => {
    const created = new Date(o.created_at).getTime();
    const responded = new Date(o.responded_at!).getTime();
    return sum + (responded - created) / 60_000;
  }, 0);

  return Math.round(totalMinutes / withResponse.length);
}

// ---------------------------------------------------------------------------
// AI strategic reasoning
// ---------------------------------------------------------------------------

async function callAIStrategy(context: DecisionContext): Promise<StrategyDecision | null> {
  const prompt = buildStrategyPrompt(context);

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ timeout: AI_TIMEOUT_MS });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    temperature: 0,
    system: `You are the strategic decision engine for NoShow, an Italian medical clinic appointment recovery system. You analyze cancellations, no-shows, and timeouts to decide the OPTIMAL strategy to fill the empty slot as fast as possible.

You must return ONLY valid JSON with this exact schema:
{
  "strategy": "cascade" | "rebook_first" | "parallel_blast" | "wait_and_cascade" | "manual_review",
  "reasoning": "1-2 sentence Italian explanation of why this strategy was chosen",
  "parallelCount": number (1-5),
  "expiryMinutes": number (10-60),
  "urgencyPrefix": string | null,
  "contactChannel": "whatsapp" | "sms" | "best_for_patient",
  "rebookCancellingPatient": boolean,
  "messagePersonalization": string | null
}

Strategy definitions:
- cascade: Standard sequential cascade, contact best candidate
- rebook_first: Try to rebook the cancelling patient before cascading (they may accept a different time)
- parallel_blast: Contact multiple candidates simultaneously (urgent slots)
- wait_and_cascade: Slot is far out; wait a bit for natural backfill before starting cascade
- manual_review: Situation is complex; flag for staff review`,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") return null;

  return parseStrategyResponse(content.text);
}

function buildStrategyPrompt(ctx: DecisionContext): string {
  const lines = [
    `EVENTO: ${eventLabel(ctx.event)}`,
    ``,
    `APPUNTAMENTO:`,
    `- Servizio: ${ctx.appointment.serviceName}`,
    `- Medico: ${ctx.appointment.providerName ?? "Qualsiasi"}`,
    `- Sede: ${ctx.appointment.locationName ?? "Principale"}`,
    `- Durata: ${ctx.appointment.durationMin} min`,
    `- Ore mancanti: ${ctx.slotAnalysis.hoursUntilSlot.toFixed(1)}h`,
    `- Urgenza: ${ctx.slotAnalysis.urgencyTier}`,
    `- Risk score paziente: ${ctx.appointment.riskScore}/100`,
    ``,
    `PAZIENTE CHE HA CANCELLATO (${ctx.appointment.patientName}):`,
    `- No-show passati: ${ctx.cancellingPatient.noShowCount}/${ctx.cancellingPatient.totalAppointments} appuntamenti`,
    `- Ha telefono: ${ctx.cancellingPatient.hasPhone ? "sì" : "no"}`,
    `- Canale preferito: ${ctx.cancellingPatient.preferredChannel}`,
  ];

  if (ctx.cancellingPatient.memoryContext) {
    lines.push(`- Profilo: ${ctx.cancellingPatient.memoryContext}`);
  }

  lines.push(
    ``,
    `ANALISI SLOT:`,
    `- Offerte già inviate per questo slot: ${ctx.slotAnalysis.previousOffersForSlot}/${ctx.slotAnalysis.maxOffersPerSlot}`,
    ctx.slotAnalysis.historicalNoShowRate !== null
      ? `- Tasso storico no-show per questo pattern orario: ${(ctx.slotAnalysis.historicalNoShowRate * 100).toFixed(0)}%`
      : `- Tasso storico no-show: dati insufficienti`,
    ``,
    `CANDIDATI DISPONIBILI:`,
    `- Totale candidati: ${ctx.candidatePool.totalCandidates}`,
    `- Score migliore candidato: ${ctx.candidatePool.topCandidateScore}/130`,
    ctx.candidatePool.avgAcceptanceRate !== null
      ? `- Tasso accettazione medio clinica: ${(ctx.candidatePool.avgAcceptanceRate * 100).toFixed(0)}%`
      : `- Tasso accettazione medio: dati insufficienti`,
    ``,
    `STATISTICHE CLINICA:`,
    ctx.tenantStats.avgFillRate !== null
      ? `- Tasso riempimento medio: ${(ctx.tenantStats.avgFillRate * 100).toFixed(0)}%`
      : `- Tasso riempimento: dati insufficienti`,
    ctx.tenantStats.avgCascadeDepth !== null
      ? `- Profondità media cascade: ${ctx.tenantStats.avgCascadeDepth.toFixed(1)} offerte`
      : `- Profondità cascade: dati insufficienti`,
    ctx.tenantStats.avgResponseMinutes !== null
      ? `- Tempo medio risposta: ${ctx.tenantStats.avgResponseMinutes} min`
      : `- Tempo medio risposta: dati insufficienti`,
  );

  lines.push(
    ``,
    `Analizza la situazione e decidi la strategia ottimale per riempire questo slot il più velocemente possibile. Considera:`,
    `1. Se il paziente ha cancellato (non no-show), potrebbe accettare un altro orario → rebook_first`,
    `2. Se lo slot è urgente (<4h), serve parallel_blast`,
    `3. Se lo slot è lontano (>48h) e pochi candidati, forse wait_and_cascade`,
    `4. Se ci sono già molte offerte senza successo, valuta manual_review`,
    `5. Se il paziente cancellante è un repeat no-show, non provare a rebook`,
  );

  return lines.join("\n");
}

function eventLabel(event: TriggerEvent): string {
  const labels: Record<TriggerEvent, string> = {
    cancellation: "Cancellazione paziente",
    no_show: "Paziente non presentato",
    timeout: "Timeout conferma",
    offer_declined: "Offerta rifiutata",
    offer_expired: "Offerta scaduta",
  };
  return labels[event];
}

function parseStrategyResponse(text: string): StrategyDecision | null {
  try {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/, "");

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;

    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

    const validStrategies = ["cascade", "rebook_first", "parallel_blast", "wait_and_cascade", "manual_review"];
    if (!validStrategies.includes(parsed.strategy as string)) return null;

    const validChannels = ["whatsapp", "sms", "best_for_patient"];
    const channel = validChannels.includes(parsed.contactChannel as string)
      ? (parsed.contactChannel as "whatsapp" | "sms" | "best_for_patient")
      : "best_for_patient";

    return {
      strategy: parsed.strategy as StrategyDecision["strategy"],
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 300) : "",
      parallelCount: clamp(Number(parsed.parallelCount) || 1, 1, 5),
      expiryMinutes: clamp(Number(parsed.expiryMinutes) || 30, 10, 60),
      urgencyPrefix: typeof parsed.urgencyPrefix === "string" ? parsed.urgencyPrefix : null,
      contactChannel: channel,
      rebookCancellingPatient: parsed.rebookCancellingPatient === true,
      messagePersonalization: typeof parsed.messagePersonalization === "string"
        ? parsed.messagePersonalization.slice(0, 200)
        : null,
      aiGenerated: true,
    };
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Rule-based fallback
// ---------------------------------------------------------------------------

function buildRuleBasedStrategy(ctx: DecisionContext): StrategyDecision {
  const { slotAnalysis, event, cancellingPatient, candidatePool } = ctx;

  // If many offers already sent with no success → flag for review
  if (slotAnalysis.previousOffersForSlot >= slotAnalysis.maxOffersPerSlot - 2) {
    return {
      strategy: "manual_review",
      reasoning: "Quasi raggiunto il limite offerte per questo slot, serve revisione manuale.",
      parallelCount: 1,
      expiryMinutes: 30,
      urgencyPrefix: null,
      contactChannel: "best_for_patient",
      rebookCancellingPatient: false,
      messagePersonalization: null,
      aiGenerated: false,
    };
  }

  // Urgent slot (<1h) → parallel blast
  if (slotAnalysis.hoursUntilSlot < 1) {
    return {
      strategy: "parallel_blast",
      reasoning: "Slot urgentissimo, meno di 1 ora. Contatto parallelo massimo.",
      parallelCount: Math.min(5, candidatePool.totalCandidates),
      expiryMinutes: 10,
      urgencyPrefix: "URGENTE",
      contactChannel: "whatsapp",
      rebookCancellingPatient: false,
      messagePersonalization: null,
      aiGenerated: false,
    };
  }

  // Semi-urgent (<4h) → parallel blast with fewer contacts
  if (slotAnalysis.hoursUntilSlot < 4) {
    return {
      strategy: "parallel_blast",
      reasoning: "Slot urgente, meno di 4 ore. Contatto parallelo.",
      parallelCount: Math.min(3, candidatePool.totalCandidates),
      expiryMinutes: 15,
      urgencyPrefix: null,
      contactChannel: "whatsapp",
      rebookCancellingPatient: false,
      messagePersonalization: null,
      aiGenerated: false,
    };
  }

  // Cancellation (not no-show) + patient is reliable → try rebook first
  if (
    event === "cancellation" &&
    cancellingPatient.hasPhone &&
    cancellingPatient.noShowCount === 0 &&
    cancellingPatient.totalAppointments >= 2
  ) {
    return {
      strategy: "rebook_first",
      reasoning: "Paziente affidabile che ha cancellato. Provo prima a riprogrammare.",
      parallelCount: 1,
      expiryMinutes: 30,
      urgencyPrefix: null,
      contactChannel: "best_for_patient",
      rebookCancellingPatient: true,
      messagePersonalization: null,
      aiGenerated: false,
    };
  }

  // Far-out slot (>48h) with few candidates → wait
  if (slotAnalysis.hoursUntilSlot > 48 && candidatePool.totalCandidates < 3) {
    return {
      strategy: "wait_and_cascade",
      reasoning: "Slot lontano con pochi candidati. Aspetto prima di attivare la cascade.",
      parallelCount: 1,
      expiryMinutes: 60,
      urgencyPrefix: null,
      contactChannel: "best_for_patient",
      rebookCancellingPatient: event === "cancellation" && cancellingPatient.hasPhone,
      messagePersonalization: null,
      aiGenerated: false,
    };
  }

  // Default: standard cascade
  const timeConfig = getTimeAwareConfig(ctx.appointment.scheduledAt);
  return {
    strategy: "cascade",
    reasoning: "Cascade standard. Contatto il miglior candidato.",
    parallelCount: timeConfig.parallelCount,
    expiryMinutes: timeConfig.expiryMinutes,
    urgencyPrefix: timeConfig.urgencyPrefix,
    contactChannel: "best_for_patient",
    rebookCancellingPatient: false,
    messagePersonalization: null,
    aiGenerated: false,
  };
}
