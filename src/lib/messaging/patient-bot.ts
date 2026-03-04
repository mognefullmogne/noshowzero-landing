/**
 * AI-powered patient conversation orchestrator.
 * 1. Load context (thread, latest appointment, active offer)
 * 2. Classify intent via regex (fallback to AI)
 * 3. Route to appropriate handler
 * 4. Generate reply
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessageIntent } from "@/lib/types";
import { classifyIntent } from "./intent-engine";
import { routeIntent } from "@/lib/webhooks/message-router";
import { updatePatientMemory } from "@/lib/ai/patient-memory";

interface PatientContext {
  readonly tenantId: string;
  readonly patientId: string;
  readonly patientPhone: string;
  readonly threadId: string;
  readonly messageBody: string;
  readonly appointmentId?: string;
  readonly offerId?: string;
}

interface BotResult {
  readonly intent: MessageIntent;
  readonly confidence: number;
  readonly reply: string;
  readonly action?: string;
}

export async function handlePatientMessage(
  supabase: SupabaseClient,
  ctx: PatientContext
): Promise<BotResult> {
  // 1. Classify intent
  const classification = classifyIntent(ctx.messageBody);

  let intent = classification.intent;
  let confidence = classification.confidence;

  // 2. If unknown, try AI classification (optional - only if ANTHROPIC_API_KEY is set)
  if (intent === "unknown" && process.env.ANTHROPIC_API_KEY) {
    const aiResult = await classifyWithAI(ctx.messageBody);
    if (aiResult.confidence > 0.6) {
      intent = aiResult.intent;
      confidence = aiResult.confidence;
    }
  }

  // 3. Load context to enhance routing
  const context = await loadPatientContext(supabase, ctx);

  // If we have an active offer and patient says yes/no, map to offer-specific intents
  if (context.activeOfferId && intent === "confirm") {
    intent = "accept_offer";
    confidence = Math.max(confidence, 0.85);
  }
  if (context.activeOfferId && intent === "cancel") {
    intent = "decline_offer";
    confidence = Math.max(confidence, 0.85);
  }

  // 4. Route to handler
  const routeResult = await routeIntent(supabase, {
    tenantId: ctx.tenantId,
    patientId: ctx.patientId,
    threadId: ctx.threadId,
    intent,
    confidence,
    messageBody: ctx.messageBody,
    appointmentId: context.nextAppointmentId ?? ctx.appointmentId,
    offerId: context.activeOfferId ?? ctx.offerId,
  });

  // 5. Fire-and-forget: update patient memory from this interaction.
  // Never awaited — never blocks the reply.
  updatePatientMemory(supabase, ctx.patientId, ctx.messageBody, intent, confidence).catch(
    (err) => console.error("[PatientBot] Memory update failed:", err)
  );

  return {
    intent,
    confidence,
    reply: routeResult.reply,
    action: routeResult.action,
  };
}

async function loadPatientContext(
  supabase: SupabaseClient,
  ctx: PatientContext
): Promise<{
  nextAppointmentId?: string;
  activeOfferId?: string;
}> {
  // Find patient's next upcoming appointment
  const { data: nextAppt } = await supabase
    .from("appointments")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .in("status", ["scheduled", "reminder_sent", "reminder_pending", "confirmed"])
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Find active offer
  const { data: activeOffer } = await supabase
    .from("waitlist_offers")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("patient_id", ctx.patientId)
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    nextAppointmentId: nextAppt?.id,
    activeOfferId: activeOffer?.id,
  };
}

async function classifyWithAI(
  text: string
): Promise<{ intent: MessageIntent; confidence: number }> {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system:
        "Classify the patient's message intent. Return JSON: {\"intent\": \"confirm|cancel|accept_offer|decline_offer|slot_select|question|unknown\", \"confidence\": 0.0-1.0}. Only return JSON.",
      messages: [{ role: "user", content: text }],
    });

    const content = response.content[0];
    if (content.type === "text") {
      const parsed = JSON.parse(content.text);
      return {
        intent: parsed.intent ?? "unknown",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      };
    }
  } catch (err) {
    console.error("[PatientBot] AI classification failed:", err);
  }

  return { intent: "unknown", confidence: 0.0 };
}
