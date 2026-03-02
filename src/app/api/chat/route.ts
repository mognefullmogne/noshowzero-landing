import { NextResponse } from "next/server";
import { z } from "zod";

// NowShow AI Assistant — rule-based responses for common questions
// Can be upgraded to use an LLM API (e.g., Anthropic) for more natural conversations

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 50;

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_MESSAGE_LENGTH),
});

const BodySchema = z.object({
  messages: z.array(ChatMessageSchema).max(MAX_MESSAGES),
});

// Smart rule-based responses for common questions
function getSmartResponse(userMessage: string): string | null {
  const lower = userMessage.toLowerCase();

  if (lower.includes("price") || lower.includes("cost") || lower.includes("how much")) {
    return "Every plan includes our AI engine. **Growth** at $199/mo gives you AI-timed reminders, AI no-show risk scoring, and AI waitlist with auto-fill (1,000 appointments, 2 locations). **Professional** at $499/mo adds AI calendar optimization, proactive reschedule suggestions, and advanced waitlist ranking (10,000 appointments, 10 locations). **Enterprise** at $999/mo is unlimited with the full AI decision engine, custom models, FHIR, and SSO. All plans include a 14-day free trial. Annual billing saves you 15-20%.";
  }

  if (lower.includes("waitlist") || lower.includes("wait list")) {
    return "Our AI-powered waitlist is included in every plan. When a slot opens up, the AI scores waitlisted clients based on clinical urgency, reliability history, time preferences, distance, and provider match — then instantly offers the slot to the best candidate. Professional and Enterprise plans get advanced ranking with even more scoring factors and proactive reschedule suggestions.";
  }

  if (lower.includes("integration") || lower.includes("api") || lower.includes("connect")) {
    return "NowShow offers a full REST API with webhooks for seamless integration with any scheduling or EHR system. Growth plans get REST API access, Professional adds webhooks and custom templates, and Enterprise includes FHIR + SSO support. We provide SDKs, documentation, and sample code — most integrations take under 15 minutes.";
  }

  if (lower.includes("setup") || lower.includes("start") || lower.includes("how fast") || lower.includes("get started")) {
    return "Setup takes under 15 minutes! Just sign up, connect your calendar or scheduling system via our API (or use the built-in dashboard), and configure your reminder preferences. We'll start reducing your no-shows immediately. No credit card needed for the 14-day trial.";
  }

  if (lower.includes("reminder") || lower.includes("sms") || lower.includes("whatsapp") || lower.includes("notification")) {
    return "We send AI-timed reminders through WhatsApp, SMS, and email. The timing is optimized based on analysis of your client behavior patterns — so reminders arrive when they're most effective. You can customize message templates and choose which channels to use per appointment type.";
  }

  if (lower.includes("trial") || lower.includes("free")) {
    return "Yes! Every plan includes a 14-day free trial with full access to all features — no credit card required. If you love it, just add your payment details to continue. If not, your account simply pauses with no charges.";
  }

  if (lower.includes("hipaa") || lower.includes("security") || lower.includes("secure") || lower.includes("gdpr")) {
    return "Security is our top priority. We use end-to-end encryption, SOC 2 compliant infrastructure, and follow HIPAA guidelines for healthcare data. We're also GDPR compliant. Your data never leaves our secure cloud environment.";
  }

  if (lower.includes("cancel") || lower.includes("switch plan") || lower.includes("upgrade") || lower.includes("downgrade")) {
    return "You can upgrade or downgrade your plan at any time from the billing page. Changes take effect at the start of your next billing cycle. If you upgrade mid-cycle, we prorate the difference. You can cancel anytime with no cancellation fees.";
  }

  if (lower.includes("industry") || lower.includes("business") || lower.includes("who") || lower.includes("salon") || lower.includes("dental") || lower.includes("clinic") || lower.includes("gym") || lower.includes("fitness")) {
    return "NowShow works for any appointment-based business: healthcare clinics, dental offices, salons & spas, auto service shops, fitness studios, consulting firms, legal practices, and more. If your business runs on appointments, we can help you eliminate no-shows.";
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return "Hello! Welcome to NowShow. I'm here to help you learn about our AI-powered appointment management platform. What would you like to know? I can tell you about pricing, features, integrations, or how to get started.";
  }

  return null;
}

export async function POST(request: Request) {
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
      return NextResponse.json({ message: "I'm ready to help! Ask me anything about NowShow." });
    }

    // Try smart response first (fast, no API needed)
    const smartResponse = getSmartResponse(lastMessage.content);
    if (smartResponse) {
      return NextResponse.json({ message: smartResponse });
    }

    // Fallback: general helpful response
    return NextResponse.json({
      message:
        "That's a great question! NowShow helps businesses eliminate no-shows with AI-powered reminders, smart waitlists, and calendar optimization. For specific details, I'd recommend starting a free trial at nowshow.com/signup or reaching out to our team at sales@nowshow.com. Is there something specific about our features, pricing, or setup I can help with?",
    });
  } catch {
    return NextResponse.json(
      { message: "Sorry, I encountered an error. Please try again." },
      { status: 500 },
    );
  }
}
