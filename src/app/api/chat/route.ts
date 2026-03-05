// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 50;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  rateLimitMap.set(ip, { ...entry, count: entry.count + 1 });
  return true;
}

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_MESSAGE_LENGTH),
});

const BodySchema = z.object({
  messages: z.array(ChatMessageSchema).max(MAX_MESSAGES),
});

const SYSTEM_PROMPT = `You are the NoShow AI assistant — a friendly, knowledgeable chatbot on the NoShow website. NoShow is an AI-powered appointment management platform that helps businesses eliminate no-shows, fill empty slots, and boost revenue.

KEY PRODUCT INFO:
- NoShow works for ALL appointment-based businesses: healthcare, dental, salons, auto service, fitness, consulting, legal, etc.
- Core features: AI-timed smart reminders (WhatsApp, SMS, email), AI no-show risk scoring, AI waitlist with auto-fill, calendar optimization, real-time analytics
- Plans: Growth ($199/mo), Professional ($499/mo), Enterprise ($999/mo). All include 14-day free trial. Annual billing saves 15-20%.
- Growth: 1,000 appts/mo, 2 locations, 5 users. AI reminders + risk scoring + waitlist + REST API.
- Professional: 10,000 appts/mo, 10 locations, 25 users. Everything in Growth + AI calendar optimization + proactive reschedule + webhooks + advanced analytics.
- Enterprise: Unlimited everything. Full AI decision engine + custom models + FHIR + SSO + dedicated support.
- Setup takes under 15 minutes via REST API or built-in dashboard.
- SOC 2 compliant, HIPAA guidelines followed, GDPR compliant, end-to-end encryption.

BEHAVIOR RULES:
- Be concise and helpful. Use 2-4 sentences for most answers.
- Bold key terms using **markdown**.
- When appropriate, suggest the user start a free trial or visit the pricing page.
- If asked about competitors, focus on NoShow's strengths without disparaging others.
- If asked about something unrelated to NoShow, gently redirect: "I specialize in NoShow's appointment management platform. How can I help you with reducing no-shows?"
- Never make up features that don't exist.
- Be warm and professional.`;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ message: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid request." }, { status: 400 });
    }

    const messages = parsed.data.messages;

    if (messages.length === 0) {
      return NextResponse.json({ message: "Please send a message to get started." });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return NextResponse.json({ message: "I'm ready to help! Ask me anything about NoShow." });
    }

    // If no API key configured, fall back to rule-based
    if (!process.env.ANTHROPIC_API_KEY) {
      const fallback = getFallbackResponse(lastMessage.content);
      return NextResponse.json({ message: fallback });
    }

    // Call Claude API
    const client = getClient();

    // Convert to Anthropic message format (keep last 10 messages for context)
    const recentMessages = messages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: recentMessages,
    });

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text
        : "I'm here to help! Ask me anything about NoShow.";

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error("Chat API error:", error);

    // On any API error, return a helpful fallback
    return NextResponse.json({
      message:
        "I'm having a brief technical moment. In the meantime: **NoShow** helps businesses eliminate no-shows with AI-powered reminders, smart waitlists, and calendar optimization. All plans include a **14-day free trial**. What would you like to know?",
    });
  }
}

// Fallback for when no API key is configured
function getFallbackResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  if (lower.includes("price") || lower.includes("cost") || lower.includes("how much")) {
    return "Every plan includes our AI engine. **Growth** at $199/mo gives you AI-timed reminders, AI no-show risk scoring, and AI waitlist with auto-fill (1,000 appointments, 2 locations). **Professional** at $499/mo adds AI calendar optimization, proactive reschedule suggestions, and advanced waitlist ranking (10,000 appointments, 10 locations). **Enterprise** at $999/mo is unlimited with the full AI decision engine, custom models, FHIR, and SSO. All plans include a 14-day free trial. Annual billing saves you 15-20%.";
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return "Hello! Welcome to NoShow. I'm here to help you learn about our AI-powered appointment management platform. What would you like to know? I can tell you about pricing, features, integrations, or how to get started.";
  }

  return "That's a great question! **NoShow** helps businesses eliminate no-shows with AI-powered reminders, smart waitlists, and calendar optimization. For specific details, I'd recommend starting a **free trial** or reaching out to our team at info@noshowzero.com. Is there something specific about our features, pricing, or setup I can help with?";
}
