/**
 * Calendar optimization engine.
 * Detects gaps, scores candidates, creates proposals.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface GapInfo {
  readonly startAt: string;
  readonly endAt: string;
  readonly providerName: string;
  readonly durationMin: number;
}

interface ScoredCandidate {
  readonly waitlistEntryId: string;
  readonly patientName: string;
  readonly score: number;
  readonly breakdown: {
    serviceMatch: number;
    gapReduction: number;
    timePreference: number;
    priority: number;
    payment: number;
  };
}

const AUTO_APPLY_THRESHOLD = parseInt(process.env.OPTIMIZATION_AUTO_APPLY_THRESHOLD ?? "90", 10);

/**
 * Run optimization analysis for a tenant.
 * Finds gaps in the calendar and proposes fills from the waitlist.
 */
export async function runOptimization(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ decisions: number; errors: string[] }> {
  const errors: string[] = [];
  let decisionsCreated = 0;

  // 1. Find gaps in next 7 days
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const gaps = await detectGaps(supabase, tenantId, now.toISOString(), weekEnd.toISOString());

  // 2. For each gap, find best waitlist candidates
  for (const gap of gaps) {
    try {
      const candidates = await scoreCandidatesForGap(supabase, tenantId, gap);
      if (candidates.length === 0) continue;

      const best = candidates[0];

      // Create optimization decision
      const { error } = await supabase.from("optimization_decisions").insert({
        tenant_id: tenantId,
        type: "gap_fill",
        status: best.score >= AUTO_APPLY_THRESHOLD ? "approved" : "proposed",
        description: `Riempire gap ${gap.providerName} ${new Date(gap.startAt).toLocaleString("it-IT")} con ${best.patientName}`,
        reasoning: `Score: ${best.score}/100. Service match: ${best.breakdown.serviceMatch}, Gap reduction: ${best.breakdown.gapReduction}, Time pref: ${best.breakdown.timePreference}`,
        score: best.score,
        target_waitlist_entry_id: best.waitlistEntryId,
        proposed_changes: {
          gap,
          candidate: best,
          action: "fill_gap",
        },
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });

      if (error) {
        errors.push(`Gap fill error: ${error.message}`);
      } else {
        decisionsCreated++;
      }
    } catch (err) {
      errors.push(`Gap ${gap.startAt}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return { decisions: decisionsCreated, errors };
}

async function detectGaps(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string
): Promise<GapInfo[]> {
  // Get available (unfilled) slots
  const { data: availableSlots } = await supabase
    .from("appointment_slots")
    .select("start_at, end_at, provider_name")
    .eq("tenant_id", tenantId)
    .eq("status", "available")
    .gte("start_at", from)
    .lte("start_at", to)
    .order("start_at", { ascending: true })
    .limit(100);

  return (availableSlots ?? []).map((s) => ({
    startAt: s.start_at,
    endAt: s.end_at,
    providerName: s.provider_name,
    durationMin: Math.round((new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 60000),
  }));
}

async function scoreCandidatesForGap(
  supabase: SupabaseClient,
  tenantId: string,
  gap: GapInfo
): Promise<ScoredCandidate[]> {
  // Get waiting waitlist entries
  const { data: entries } = await supabase
    .from("waitlist_entries")
    .select("id, service_name, preferred_provider, preferred_time_slots, clinical_urgency, payment_category, smart_score, patient:patients(first_name, last_name)")
    .eq("tenant_id", tenantId)
    .eq("status", "waiting")
    .limit(50);

  if (!entries || entries.length === 0) return [];

  const gapDate = new Date(gap.startAt);
  const gapDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][gapDate.getDay()] as string;
  const gapHour = gapDate.getHours();

  return entries
    .map((entry) => {
      const patient = entry.patient as unknown as Record<string, string> | null;
      let score = 0;

      // Service match (30 points)
      const serviceMatch = 30; // All waiting entries are potentially suitable
      score += serviceMatch;

      // Gap reduction (25 points) — based on smart_score
      const gapReduction = Math.min(25, Math.round(((entry.smart_score ?? 50) / 100) * 25));
      score += gapReduction;

      // Time preference (20 points)
      let timePreference = 10; // base
      const slots = entry.preferred_time_slots as Array<{ day: string; from: string; to: string }> | null;
      if (slots && slots.length > 0) {
        const matchingSlot = slots.find(
          (s) => s.day === gapDay && gapHour >= parseInt(s.from) && gapHour < parseInt(s.to)
        );
        timePreference = matchingSlot ? 20 : 5;
      }
      score += timePreference;

      // Priority (15 points) — based on urgency
      const urgencyMap: Record<string, number> = { critical: 15, high: 12, medium: 8, low: 4, none: 0 };
      const priority = urgencyMap[entry.clinical_urgency] ?? 0;
      score += priority;

      // Payment match (10 points) — assume match if same category
      const payment = entry.payment_category ? 10 : 5;
      score += payment;

      // Provider match bonus
      if (entry.preferred_provider && entry.preferred_provider === gap.providerName) {
        score += 5;
      }

      return {
        waitlistEntryId: entry.id,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : "N/A",
        score: Math.min(100, score),
        breakdown: { serviceMatch, gapReduction, timePreference, priority, payment },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Execute an approved optimization decision.
 */
export async function executeDecision(
  supabase: SupabaseClient,
  tenantId: string,
  decisionId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: decision } = await supabase
    .from("optimization_decisions")
    .select("*")
    .eq("id", decisionId)
    .eq("tenant_id", tenantId)
    .eq("status", "approved")
    .maybeSingle();

  if (!decision) return { success: false, error: "Decision not found or not approved" };

  // Mark as executed
  const { error } = await supabase
    .from("optimization_decisions")
    .update({
      status: "executed",
      executed_at: new Date().toISOString(),
    })
    .eq("id", decisionId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
