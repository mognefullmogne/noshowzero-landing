/**
 * Smart Rebooking Suggestion Generator
 *
 * When a patient cancels, analyze their history and available slots to
 * propose 2-3 personalised rebooking options in Italian via WhatsApp.
 *
 * Uses Claude Haiku for cost-efficiency.
 * Falls back to a generic rebooking invite if AI fails.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CancelledAppointment {
  readonly id: string;
  readonly service_name: string;
  readonly provider_name: string | null;
  readonly location_name: string | null;
  readonly scheduled_at: string;
  readonly duration_min: number;
}

export interface RebookingSlot {
  readonly startAt: string;
  readonly endAt: string;
  readonly providerName: string;
  readonly dayLabel: string;  // e.g. "Mercoledì 12 marzo"
  readonly timeLabel: string; // e.g. "10:00"
  readonly attendanceNote: string; // e.g. "il tuo orario preferito!"
}

export interface RebookingSuggestions {
  readonly message: string;
  readonly suggestedSlots: readonly RebookingSlot[];
}

// ---------------------------------------------------------------------------
// Data gathering
// ---------------------------------------------------------------------------

interface PatientHistory {
  readonly firstName: string;
  readonly preferredHours: readonly number[];   // hours of day they usually book
  readonly preferredDays: readonly number[];    // days of week (0=Sun)
  readonly avgNoShowRate: number;               // 0.0 - 1.0 from their own history
  readonly phone: string | null;
}

async function loadPatientHistory(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<PatientHistory> {
  const [patientRes, historyRes] = await Promise.all([
    supabase
      .from("patients")
      .select("first_name, phone, response_patterns, preferred_channel")
      .eq("id", patientId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("scheduled_at, status")
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .in("status", ["completed", "no_show", "confirmed", "cancelled"])
      .lt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: false })
      .limit(50),
  ]);

  const patient = patientRes.data;
  const appointments = historyRes.data ?? [];

  const firstName = patient?.first_name ?? "Paziente";
  const phone = patient?.phone ?? null;

  // Compute preferred hours/days from past appointments
  const hourCounts = new Map<number, number>();
  const dayCounts = new Map<number, number>();
  let noShows = 0;
  let total = 0;

  for (const appt of appointments) {
    const d = new Date(appt.scheduled_at);
    const hour = d.getUTCHours();
    const day = d.getUTCDay();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    total++;
    if (appt.status === "no_show") noShows++;
  }

  // Top 3 preferred hours and days by frequency
  const preferredHours = [...hourCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h]) => h);

  const preferredDays = [...dayCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d]) => d);

  const avgNoShowRate = total > 0 ? noShows / total : 0;

  return { firstName, preferredHours, preferredDays, avgNoShowRate, phone };
}

/** Fetch available slots from appointment_slots table for the next 14 days. */
async function fetchAvailableSlots(
  supabase: SupabaseClient,
  tenantId: string,
  serviceName: string,
  durationMin: number
): Promise<readonly RebookingSlot[]> {
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 3600 * 1000);

  // Try appointment_slots table first; gracefully skip if absent
  try {
    const { data: slots, error } = await supabase
      .from("appointment_slots")
      .select("id, start_at, end_at, provider_name")
      .eq("tenant_id", tenantId)
      .eq("status", "available")
      .gte("start_at", now.toISOString())
      .lte("start_at", twoWeeksOut.toISOString())
      .order("start_at", { ascending: true })
      .limit(20);

    if (error) throw error;
    if (!slots || slots.length === 0) return [];

    return slots
      .filter((s) => {
        const slotDuration =
          (new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 60_000;
        return slotDuration >= durationMin;
      })
      .map((s) => buildSlot(s.start_at, s.end_at, s.provider_name ?? ""));
  } catch {
    // Slots table may not exist — return empty list for fallback path
    return [];
  }
}

function buildSlot(startAt: string, endAt: string, providerName: string): RebookingSlot {
  const d = new Date(startAt);
  return {
    startAt,
    endAt,
    providerName,
    dayLabel: d.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    timeLabel: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    attendanceNote: "",
  };
}

// ---------------------------------------------------------------------------
// AI message generation
// ---------------------------------------------------------------------------

function buildFallbackMessage(firstName: string, serviceName: string): string {
  return `Ciao ${firstName}! Hai cancellato il tuo appuntamento per ${serviceName}. Vorresti riprogrammarlo? Contatta la segreteria o rispondi a questo messaggio per scegliere un nuovo orario.`;
}

async function generateAISuggestions(
  firstName: string,
  serviceName: string,
  cancelledAt: string,
  slots: readonly RebookingSlot[],
  history: PatientHistory
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY || slots.length === 0) {
    return buildFallbackMessage(firstName, serviceName);
  }

  const cancelledDate = new Date(cancelledAt).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const slotLines = slots.slice(0, 3).map((s, i) => {
    const isPreferredHour = history.preferredHours.includes(new Date(s.startAt).getUTCHours());
    const isPreferredDay = history.preferredDays.includes(new Date(s.startAt).getUTCDay());
    let note = "";
    if (isPreferredHour && isPreferredDay) note = "il tuo orario preferito!";
    else if (isPreferredHour) note = "orario che preferisci";
    else if (isPreferredDay) note = "giorno che preferisci";
    return `${i + 1}. ${s.dayLabel} alle ${s.timeLabel}${note ? ` — ${note}` : ""}`;
  });

  const prompt = `Genera un breve messaggio WhatsApp in italiano per un paziente che ha appena cancellato un appuntamento.
Il messaggio deve:
- Iniziare con "Ciao ${firstName}!"
- Menzionare la cancellazione dell'appuntamento di ${cancelledDate} per ${serviceName}
- Proporre massimo 3 slot disponibili in modo amichevole
- Chiedere di rispondere con 1, 2 o 3 per prenotare subito
- Essere massimo 250 caratteri totali
- Essere in italiano informale

Slot disponibili:
${slotLines.join("\n")}

Rispondi SOLO con il messaggio WhatsApp. Niente JSON, niente spiegazioni.`;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ timeout: 10_000 });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text" || !content.text.trim()) {
      return buildFallbackMessage(firstName, serviceName);
    }

    return content.text.trim();
  } catch (err) {
    console.error("[SmartRebook] AI generation failed:", err);
    return buildFallbackMessage(firstName, serviceName);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate smart rebooking suggestions when a patient cancels.
 *
 * @param supabase              Supabase client
 * @param tenantId              Tenant ID
 * @param patientId             Patient who cancelled
 * @param cancelledAppointment  The appointment that was cancelled
 * @returns                     Italian WhatsApp message + suggested slots
 */
export async function generateRebookingSuggestions(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  cancelledAppointment: CancelledAppointment
): Promise<RebookingSuggestions> {
  const [history, availableSlots] = await Promise.all([
    loadPatientHistory(supabase, tenantId, patientId),
    fetchAvailableSlots(
      supabase,
      tenantId,
      cancelledAppointment.service_name,
      cancelledAppointment.duration_min
    ),
  ]);

  // Sort available slots: prefer patient's preferred days/hours
  const scoredSlots = availableSlots.map((slot) => {
    const d = new Date(slot.startAt);
    const dayScore = history.preferredDays.indexOf(d.getUTCDay());
    const hourScore = history.preferredHours.indexOf(d.getUTCHours());
    const score =
      (dayScore !== -1 ? 3 - dayScore : 0) +
      (hourScore !== -1 ? 3 - hourScore : 0);
    return { slot, score };
  });

  scoredSlots.sort((a, b) => b.score - a.score);
  const topSlots = scoredSlots.slice(0, 3).map((s) => s.slot);

  const message = await generateAISuggestions(
    history.firstName,
    cancelledAppointment.service_name,
    cancelledAppointment.scheduled_at,
    topSlots,
    history
  );

  return { message, suggestedSlots: topSlots };
}
