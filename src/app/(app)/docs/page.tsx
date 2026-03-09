// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState, useEffect } from "react";
import {
  BookOpen,
  Key,
  Send,
  Users,
  CalendarDays,
  Bell,
  ListChecks,
  Copy,
  Check,
  ChevronRight,
  Code,
  Zap,
  ArrowRight,
  Monitor,
  Repeat,
  Settings,
  Info,
  Brain,
  BarChart3,
  Webhook,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

function useApiBase() {
  const [base, setBase] = useState("https://your-domain.com/api/v1");
  useEffect(() => {
    setBase(`${window.location.origin}/api/v1`);
  }, []);
  return base;
}

interface CodeBlockProps {
  readonly code: string;
  readonly language?: string;
}

function CodeBlock({ code, language = "javascript" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — user can select manually
    }
  }

  return (
    <div className="relative rounded-xl border border-black/[0.06] bg-gray-950 text-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs font-medium text-gray-400">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-gray-100 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const SECTIONS = [
  { id: "how-it-works", label: "How It Works", icon: Zap },
  { id: "no-code", label: "No Code Needed", icon: Monitor },
  { id: "quick-start", label: "Developer Setup", icon: Code },
  { id: "authentication", label: "Authentication", icon: Key },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "patients", label: "Patients", icon: Users },
  { id: "waitlist", label: "Waitlist", icon: ListChecks },
  { id: "intelligence", label: "AI Intelligence", icon: Brain },
  { id: "messaging", label: "Messaging", icon: MessageSquare },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "errors", label: "Error Handling", icon: Settings },
] as const;

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("how-it-works");
  const API_BASE = useApiBase();

  function scrollTo(id: string) {
    setActiveSection(id);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex gap-8">
      {/* Side nav */}
      <nav className="hidden lg:block w-56 flex-shrink-0">
        <div className="sticky top-8 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Documentation
          </p>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollTo(section.id)}
              className={cn(
                "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium transition-all text-left",
                activeSection === section.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
              )}
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-12">

        {/* How It Works */}
        <section id="how-it-works">
          <h1 className="text-2xl font-bold text-gray-900">How NowShow Works</h1>
          <p className="mt-2 text-gray-600 leading-relaxed">
            NowShow plugs into your existing scheduling software and <strong>runs entirely on autopilot</strong>.
            There is nothing to run manually — once connected, the AI handles everything.
          </p>

          <div className="mt-8 space-y-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">
              {[
                {
                  step: "1",
                  title: "Your software creates an appointment",
                  desc: "A client books via your website, app, or front desk. Your system sends the appointment data to NowShow automatically.",
                  color: "blue",
                },
                {
                  step: "2",
                  title: "NowShow AI takes over",
                  desc: "We score the no-show risk, pick the best reminder channel & timing, and schedule everything. Zero human effort.",
                  color: "indigo",
                },
                {
                  step: "3",
                  title: "Clients show up, slots stay filled",
                  desc: "Reminders go out on WhatsApp, SMS, or email. If someone cancels, the waitlist AI fills the slot in minutes.",
                  color: "green",
                },
              ].map((item) => (
                <div key={item.step} className="relative p-5 rounded-xl border border-black/[0.04] bg-white">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white",
                    item.color === "blue" && "bg-blue-600",
                    item.color === "indigo" && "bg-indigo-600",
                    item.color === "green" && "bg-green-600",
                  )}>
                    {item.step}
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-green-100 bg-green-50/50 px-5 py-4">
            <div className="flex items-start gap-3">
              <Repeat className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">This is fully automatic</p>
                <p className="text-xs text-green-600 mt-0.5">
                  After the one-time setup, your scheduling software talks to NowShow in the background.
                  Every new appointment is automatically analyzed, reminders are sent at the perfect time,
                  and cancellations trigger instant waitlist matching. Nobody runs any commands — it just works.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* No Code Option */}
        <section id="no-code">
          <h2 className="text-xl font-bold text-gray-900">Option A: No Code Needed</h2>
          <p className="mt-2 text-sm text-gray-600">
            If you don&apos;t have custom scheduling software and just want to use NowShow directly,
            you don&apos;t need any code at all.
          </p>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm flex-shrink-0">
                <Monitor className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Use the NowShow Dashboard</h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  Log in to your NowShow account, add appointments through our web interface,
                  manage your waitlist, and see analytics — all without writing a single line of code.
                  The AI works the same way whether you use the dashboard or the API.
                </p>
                <p className="mt-3 text-sm text-gray-600">
                  <strong>Perfect for:</strong> Solo practitioners, small salons, individual clinics, or anyone
                  who manages appointments manually or with a basic calendar.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">When do you need the API?</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  The API is for <strong>software companies</strong> or businesses with <strong>existing scheduling systems</strong> (like
                  an EHR, a booking platform, or a custom app) that want to integrate NowShow automatically.
                  If you book appointments using Google Calendar, a notebook, or our dashboard — you don&apos;t need it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Developer Quick Start */}
        <section id="quick-start">
          <h2 className="text-xl font-bold text-gray-900">Option B: API Integration (for Developers)</h2>
          <p className="mt-2 text-sm text-gray-600">
            If you have existing scheduling software, a developer connects it to NowShow <strong>once</strong>.
            After that, everything is automatic — your software sends appointments to NowShow, and NowShow handles the rest.
          </p>

          <div className="mt-6 space-y-8">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">1</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Get your API key (one time)</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Go to your <a href="/dashboard" className="text-blue-600 underline">Dashboard</a> and click
                  &quot;Generate New Key&quot;. Your developer adds this key to your software&apos;s configuration.
                  Keys use the <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">nows_</code> prefix.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">2</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Add a few lines to your booking code (one time)</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Wherever your software creates a new appointment, add a call to NowShow.
                  Here&apos;s what that looks like — this code goes <strong>inside your existing software</strong> and runs automatically every time a client books:
                </p>

                <div className="mt-3 space-y-3">
                  <CodeBlock language="javascript" code={`// This goes inside YOUR booking software — runs automatically
// whenever a new appointment is created

async function onAppointmentCreated(appointment) {
  const API_BASE = "${API_BASE}";

  // Send the appointment to NowShow — AI handles the rest
  await fetch(\`\${API_BASE}/appointments\`, {
    method: "POST",
    headers: {
      "X-API-Key": process.env.NOWSHOW_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_id: appointment.id,
      patient: {
        external_id: appointment.clientId,
        first_name: appointment.firstName,
        last_name: appointment.lastName,
        phone: appointment.phone,
        email: appointment.email,
      },
      service_name: appointment.serviceType,
      provider_name: appointment.staffName,
      scheduled_at: appointment.dateTime,  // ISO 8601
      duration_min: appointment.duration,   // 5-480 minutes
    }),
  });
  // That's it! NowShow now:
  // ✓ Scores the no-show risk with AI
  // ✓ Schedules smart reminders (WhatsApp, SMS, email)
  // ✓ Monitors for cancellations
  // ✓ Auto-fills from waitlist if cancelled
}`} />

                  <CodeBlock language="python" code={`# Python version — same idea, goes inside your booking system

import requests, os

def on_appointment_created(appointment):
    """Called automatically when a client books."""
    API_BASE = "${API_BASE}"

    requests.post(
        f"{API_BASE}/appointments",
        headers={
            "X-API-Key": os.environ["NOWSHOW_API_KEY"],
            "Content-Type": "application/json",
        },
        json={
            "external_id": appointment["id"],
            "patient": {
                "external_id": appointment["client_id"],
                "first_name": appointment["first_name"],
                "last_name": appointment["last_name"],
                "phone": appointment["phone"],
                "email": appointment["email"],
            },
            "service_name": appointment["service_type"],
            "provider_name": appointment["staff_name"],
            "scheduled_at": appointment["date_time"],
            "duration_min": appointment["duration"],
        },
    )
    # Done! NowShow AI takes it from here.`} />
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">3</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Optionally: handle cancellations too</h3>
                <p className="mt-1 text-sm text-gray-500">
                  If a client cancels through your software, tell NowShow so the AI can instantly offer the slot to the next person on the waitlist:
                </p>

                <div className="mt-3">
                  <CodeBlock language="javascript" code={`// Also inside your software — runs when a client cancels
const API_BASE = "${API_BASE}";

async function onAppointmentCancelled(externalId, reason) {
  await fetch(
    \`\${API_BASE}/appointments/\${externalId}\`,
    {
      method: "PATCH",
      headers: {
        "X-API-Key": process.env.NOWSHOW_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "cancelled",
        cancellation_reason: reason,
      }),
    }
  );
  // NowShow instantly triggers the waitlist backfill cascade
}`} />
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                <Check className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">That&apos;s the entire integration</h3>
                <p className="mt-1 text-sm text-gray-500">
                  From this point forward, everything is automatic. Your software creates appointments
                  as usual, NowShow analyzes each one, sends perfectly timed reminders, and fills
                  cancellations from the waitlist. No manual work, no commands to run, no monitoring needed.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Authentication */}
        <section id="authentication">
          <h2 className="text-xl font-bold text-gray-900">Authentication</h2>
          <p className="mt-2 text-sm text-gray-600">
            Every API request includes your key in the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 text-xs">X-API-Key</code> header.
            Keys use the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 text-xs">nows_</code> prefix.
          </p>

          <div className="mt-4">
            <CodeBlock language="javascript" code={`// Set your API key once in your app's config
const NOWSHOW_API_KEY = process.env.NOWSHOW_API_KEY; // nows_...

// Every request to NowShow includes this header automatically
const headers = {
  "X-API-Key": NOWSHOW_API_KEY,
  "Content-Type": "application/json",
};`} />
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
            <p className="text-sm text-blue-800">
              <strong>Base URL:</strong>{" "}
              <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-700 text-xs">{API_BASE}</code>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              All requests use HTTPS. Store your API key in an environment variable — never in client-side code.
            </p>
          </div>

          <div className="mt-4">
            <CodeBlock language="json" code={`// All responses follow this envelope format
{
  "success": true,
  "data": { ... },
  "error": null
}

// Error responses
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "scheduled_at is required"
  }
}`} />
          </div>
        </section>

        {/* Appointments */}
        <section id="appointments">
          <h2 className="text-xl font-bold text-gray-900">Appointments</h2>
          <p className="mt-2 text-sm text-gray-600">
            When your software sends an appointment to NowShow, the AI automatically scores
            the no-show risk and schedules the optimal reminders. No further action needed.
          </p>

          <div className="mt-6 space-y-4">
            <EndpointBlock
              method="POST"
              path="/appointments"
              description="Create a new appointment"
              requestBody={`{
  "external_id": "apt-12345",
  "patient": {
    "external_id": "pat-678",
    "first_name": "John",
    "last_name": "Smith",
    "phone": "+1234567890",
    "email": "john@example.com"
  },
  "service_name": "General Checkup",
  "service_code": "GEN-CHK",
  "provider_name": "Dr. Sarah Chen",
  "location_name": "Main Clinic",
  "scheduled_at": "2026-03-10T14:00:00Z",
  "duration_min": 30,
  "payment_category": "insurance",
  "notes": "Follow-up visit"
}`}
              responseBody={`// 201 Created
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "risk_score": 0.23,
    "reminders_scheduled": 2
  }
}

// Patient is auto-created or updated from the patient object.
// AI immediately scores risk and schedules reminders.`}
            />

            <EndpointBlock
              method="GET"
              path="/appointments/:externalId"
              description="Get appointment details by your external ID"
              requestBody={null}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "external_id": "apt-12345",
    "status": "confirmed",
    "risk_score": 0.23,
    "risk_reasoning": "Low risk: regular patient with good history",
    "scheduled_at": "2026-03-10T14:00:00Z",
    "duration_min": 30,
    "service_name": "General Checkup",
    "provider_name": "Dr. Sarah Chen",
    "confirmed_at": "2026-03-08T15:30:00Z",
    "declined_at": null,
    "created_at": "2026-03-03T12:00:00Z",
    "reminders": [
      { "id": "...", "channel": "whatsapp", "status": "delivered", "sent_at": "..." },
      { "id": "...", "channel": "sms", "status": "scheduled", "send_at": "..." }
    ]
  }
}`}
            />

            <EndpointBlock
              method="PATCH"
              path="/appointments/:externalId"
              description="Update status or reschedule"
              requestBody={`{
  "status": "cancelled",
  "cancellation_reason": "Patient requested reschedule"
}

// Or reschedule:
{
  "scheduled_at": "2026-03-12T10:00:00Z",
  "duration_min": 45,
  "notes": "Rescheduled from March 10"
}

// Valid statuses: "cancelled", "completed", "no_show"`}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "external_id": "apt-12345",
    "status": "cancelled",
    "reminders": [...]
  }
}

// Cancellation triggers waitlist backfill cascade automatically.
// Webhooks fire for appointment.cancelled event.`}
            />
          </div>
        </section>

        {/* Patients */}
        <section id="patients">
          <h2 className="text-xl font-bold text-gray-900">Patients</h2>
          <p className="mt-2 text-sm text-gray-600">
            NowShow automatically builds a reliability profile for each patient over time.
            Patients are created automatically when you create appointments, or you can manage them directly.
          </p>

          <div className="mt-6 space-y-4">
            <EndpointBlock
              method="POST"
              path="/patients"
              description="Create or update a patient"
              requestBody={`{
  "external_id": "pat-678",
  "first_name": "John",
  "last_name": "Smith",
  "phone": "+1234567890",
  "email": "john@example.com",
  "preferred_channel": "whatsapp"
}

// preferred_channel: "whatsapp" | "sms" | "email"
// If patient exists by external_id, updates instead of creating.`}
              responseBody={`// 201 Created (or 200 if updated)
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "external_id": "pat-678",
    "first_name": "John",
    "last_name": "Smith",
    "email": "john@example.com",
    "preferred_channel": "whatsapp",
    "is_active": true,
    "created": true
  }
}`}
            />

            <EndpointBlock
              method="GET"
              path="/patients/:externalId/memory"
              description="Get AI-extracted patient preferences"
              requestBody={null}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "preferences": {
      "preferred_times": ["morning"],
      "preferred_days": ["monday", "wednesday"],
      "preferred_provider": "Dr. Sarah Chen",
      "communication_style": "brief",
      "language": "en",
      "notes": "Prefers early morning slots"
    },
    "extracted_from_conversations": 8,
    "last_updated": "2026-03-05T09:00:00Z"
  }
}

// Preferences are extracted from patient conversations by AI.`}
            />

            <EndpointBlock
              method="GET"
              path="/patients/:externalId/reliability"
              description="Get reliability score and history"
              requestBody={null}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "reliability_score": 85,
    "total_appointments": 12,
    "completed": 10,
    "no_shows": 1,
    "cancellations": 1,
    "last_visit": "2026-02-28T14:00:00Z"
  }
}

// Score = (completed / total) * 100
// AI uses this to calibrate reminder intensity.`}
            />
          </div>
        </section>

        {/* Waitlist */}
        <section id="waitlist">
          <h2 className="text-xl font-bold text-gray-900">Waitlist</h2>
          <p className="mt-2 text-sm text-gray-600">
            Add patients to the waitlist, and the AI automatically fills cancelled slots by scoring
            candidates on urgency, reliability, time preferences, and history — no manual matching needed.
          </p>

          <div className="mt-6 space-y-4">
            <EndpointBlock
              method="POST"
              path="/waitlist"
              description="Add a patient to the waitlist"
              requestBody={`{
  "patient_external_id": "pat-678",
  "service_name": "General Checkup",
  "preferred_providers": ["Dr. Sarah Chen"],
  "preferred_times": ["morning", "afternoon"],
  "urgency": "medium",
  "notes": "Needs follow-up within 2 weeks"
}

// urgency: "none" | "low" | "medium" | "high" | "critical"
// Patient must exist first (create via POST /patients or POST /appointments).`}
              responseBody={`// 201 Created
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "waiting",
    "service_name": "General Checkup",
    "clinical_urgency": "medium",
    "smart_score": 78,
    "priority_score": 82,
    "created_at": "2026-03-03T12:00:00Z"
  }
}

// smart_score: AI-calculated from patient history
// priority_score: combines urgency + smart_score + wait time
// When a slot opens, higher priority gets offered first.`}
            />

            <EndpointBlock
              method="GET"
              path="/waitlist"
              description="List waitlist entries with filters"
              requestBody={null}
              responseBody={`// 200 OK — GET /waitlist?status=waiting&limit=20&page=1
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "...",
        "status": "waiting",
        "service_name": "General Checkup",
        "smart_score": 78,
        "priority_score": 82
      }
    ],
    "total": 12,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}

// Query params:
//   status: waiting | offer_pending | offer_accepted |
//           offer_declined | offer_timeout | fulfilled |
//           expired | withdrawn
//   service_name: partial match filter
//   limit: 1-100 (default 50)
//   page: starts at 1
// Sorted by priority_score descending.`}
            />

            <EndpointBlock
              method="GET"
              path="/waitlist/:id"
              description="Get waitlist entry with offer history"
              requestBody={null}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "offer_pending",
    "service_name": "General Checkup",
    "smart_score": 78,
    "priority_score": 82,
    "offers": [
      {
        "id": "...",
        "status": "pending",
        "slot_start": "2026-03-10T14:00:00Z",
        "slot_end": "2026-03-10T14:30:00Z",
        "offered_at": "2026-03-08T09:00:00Z",
        "responded_at": null,
        "expires_at": "2026-03-08T11:00:00Z"
      }
    ]
  }
}`}
            />

            <EndpointBlock
              method="DELETE"
              path="/waitlist/:id"
              description="Withdraw from the waitlist"
              requestBody={null}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "message": "Entry withdrawn"
  }
}

// Sets status to "withdrawn". Idempotent — already-withdrawn entries return success.`}
            />
          </div>
        </section>

        {/* AI Intelligence */}
        <section id="intelligence">
          <h2 className="text-xl font-bold text-gray-900">AI Intelligence</h2>
          <p className="mt-2 text-sm text-gray-600">
            Access NowShow&apos;s AI-powered features directly: risk scoring, rebooking suggestions,
            no-show pattern analysis, overbooking recommendations, morning briefings, and operator chat.
          </p>

          <div className="mt-6 space-y-4">
            <EndpointBlock
              method="GET"
              path="/appointments/:externalId/risk"
              description="Get current risk score"
              requestBody={null}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "score": 0.23,
    "reasoning": "Low risk: regular patient, 85% reliability, morning slot",
    "scored_at": "2026-03-03T12:00:00Z"
  }
}`}
            />

            <EndpointBlock
              method="POST"
              path="/appointments/:externalId/risk"
              description="Recalculate risk score with AI"
              requestBody={null}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "score": 0.31,
    "reasoning": "Slight increase: appointment rescheduled once",
    "ai_generated": true,
    "previous_score": 0.23
  }
}`}
            />

            <EndpointBlock
              method="GET"
              path="/appointments/:externalId/rebook"
              description="Get AI rebooking suggestions for cancelled appointment"
              requestBody={null}
              responseBody={`// 200 OK — Only works when appointment status is "cancelled"
{
  "success": true,
  "data": {
    "available_slots": [
      { "start": "2026-03-12T09:00:00Z", "end": "2026-03-12T09:30:00Z" },
      { "start": "2026-03-12T14:00:00Z", "end": "2026-03-12T14:30:00Z" }
    ],
    "suggested_slots": [
      { "start": "2026-03-12T09:00:00Z", "end": "2026-03-12T09:30:00Z" }
    ],
    "message": "Based on patient preferences, morning slots recommended"
  }
}`}
            />

            <EndpointBlock
              method="POST"
              path="/chat"
              description="Operator chat — ask the AI about your practice"
              requestBody={`{
  "message": "Which patients are high risk this week?",
  "history": [
    { "role": "user", "content": "Show me today's schedule" },
    { "role": "assistant", "content": "You have 12 appointments today..." }
  ]
}

// history is optional — include for multi-turn conversations.`}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "response": "You have 3 high-risk appointments this week...",
    "tool_calls": [],
    "tokens_used": 450
  }
}`}
            />

            <EndpointBlock
              method="GET"
              path="/briefing"
              description="AI morning briefing for a date"
              requestBody={null}
              responseBody={`// 200 OK — GET /briefing?date=2026-03-10
{
  "success": true,
  "data": {
    "briefing": {
      "summary": "14 appointments today, 2 high-risk...",
      "high_risk": [...],
      "waitlist_opportunities": [...]
    },
    "date": "2026-03-10",
    "generated_at": "2026-03-10T06:00:00Z",
    "cached": false
  }
}

// Query params:
//   date: YYYY-MM-DD (defaults to today)
//   refresh: 1 (force regeneration, skip cache)`}
            />

            <EndpointBlock
              method="GET"
              path="/analytics/no-show-analysis"
              description="AI-powered no-show pattern analysis"
              requestBody={null}
              responseBody={`// 200 OK — GET /analytics/no-show-analysis
{
  "success": true,
  "data": {
    "analysis": {
      "patterns": [...],
      "recommendations": [...],
      "risk_factors": [...]
    },
    "generated_at": "2026-03-09T08:00:00Z",
    "cached": true
  }
}

// Add ?refresh=1 to force regeneration.
// Results are cached for performance.`}
            />

            <EndpointBlock
              method="GET"
              path="/analytics/overbooking"
              description="Overbooking recommendations for a date"
              requestBody={null}
              responseBody={`// 200 OK — GET /analytics/overbooking?date=2026-03-10
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "time_slot": "09:00-10:00",
        "current_bookings": 3,
        "suggested_bookings": 4,
        "confidence": 0.82
      }
    ],
    "date": "2026-03-10"
  }
}

// date: YYYY-MM-DD (defaults to today)`}
            />
          </div>
        </section>

        {/* Messaging */}
        <section id="messaging">
          <h2 className="text-xl font-bold text-gray-900">Messaging</h2>
          <p className="mt-2 text-sm text-gray-600">
            Send messages to patients via WhatsApp or SMS, and classify incoming message intent with AI.
          </p>

          <div className="mt-6 space-y-4">
            <EndpointBlock
              method="POST"
              path="/messages/send"
              description="Send a message to a patient"
              requestBody={`{
  "patient_external_id": "pat-678",
  "message": "Your lab results are ready. Please call to schedule a follow-up.",
  "channel": "whatsapp"
}

// channel: "whatsapp" | "sms" (optional, defaults to patient's preferred_channel)
// Patient must have a phone number on file.`}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "message_sid": "SM1234567890abcdef",
    "channel": "whatsapp",
    "status": "queued"
  }
}`}
            />

            <EndpointBlock
              method="POST"
              path="/messages/classify"
              description="Classify a message's intent with AI"
              requestBody={`{
  "message": "I need to cancel my appointment tomorrow",
  "context": {
    "appointment_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}

// context is optional — improves classification accuracy.`}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "intent": "cancel",
    "confidence": 0.95,
    "source": "intent-engine"
  }
}

// Common intents: confirm, cancel, reschedule, question, greeting`}
            />
          </div>
        </section>

        {/* Webhooks */}
        <section id="webhooks">
          <h2 className="text-xl font-bold text-gray-900">Webhooks</h2>
          <p className="mt-2 text-sm text-gray-600">
            Register webhook endpoints to receive real-time notifications when events happen.
            NowShow signs payloads with HMAC-SHA256 so you can verify authenticity.
          </p>

          <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Available webhook events</p>
            <div className="space-y-2">
              {[
                { event: "appointment.created", desc: "New appointment registered" },
                { event: "appointment.cancelled", desc: "Appointment was cancelled" },
                { event: "appointment.completed", desc: "Appointment completed successfully" },
                { event: "appointment.no_show", desc: "Patient didn't show up" },
              ].map(({ event, desc }) => (
                <div key={event} className="flex items-start gap-3">
                  <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-700 flex-shrink-0">
                    {event}
                  </code>
                  <span className="text-xs text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <EndpointBlock
              method="POST"
              path="/webhooks"
              description="Register a webhook endpoint"
              requestBody={`{
  "url": "https://your-app.com/webhooks/nowshow",
  "events": ["appointment.cancelled", "appointment.no_show"]
}`}
              responseBody={`// 201 Created
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://your-app.com/webhooks/nowshow",
    "secret": "a1b2c3d4e5f6...",
    "events": ["appointment.cancelled", "appointment.no_show"],
    "is_active": true,
    "created_at": "2026-03-03T12:00:00Z"
  }
}

// Save the "secret" — use it to verify HMAC-SHA256 signatures on incoming payloads.`}
            />

            <EndpointBlock
              method="GET"
              path="/webhooks"
              description="List all webhook endpoints"
              requestBody={null}
              responseBody={`// 200 OK
{
  "success": true,
  "data": [
    {
      "id": "...",
      "url": "https://your-app.com/webhooks/nowshow",
      "events": ["appointment.cancelled", "appointment.no_show"],
      "is_active": true,
      "created_at": "2026-03-03T12:00:00Z",
      "updated_at": "2026-03-03T12:00:00Z"
    }
  ]
}`}
            />

            <EndpointBlock
              method="PATCH"
              path="/webhooks/:id"
              description="Update webhook configuration"
              requestBody={`{
  "url": "https://your-app.com/webhooks/v2/nowshow",
  "events": ["appointment.cancelled", "appointment.no_show", "appointment.completed"],
  "is_active": true
}

// All fields are optional — send only what you want to change.`}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "id": "...",
    "url": "https://your-app.com/webhooks/v2/nowshow",
    "events": ["appointment.cancelled", "appointment.no_show", "appointment.completed"],
    "is_active": true,
    "updated_at": "2026-03-09T15:00:00Z"
  }
}`}
            />

            <EndpointBlock
              method="DELETE"
              path="/webhooks/:id"
              description="Deactivate a webhook endpoint"
              requestBody={null}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "message": "Webhook deactivated",
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}

// Soft-deletes (sets is_active to false). Does not permanently delete.`}
            />
          </div>
        </section>

        {/* Analytics */}
        <section id="analytics">
          <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
          <p className="mt-2 text-sm text-gray-600">
            Get high-level metrics about your practice&apos;s appointment performance and no-show rates.
          </p>

          <div className="mt-6">
            <EndpointBlock
              method="GET"
              path="/analytics/summary"
              description="Practice performance dashboard metrics"
              requestBody={null}
              responseBody={`// 200 OK
{
  "success": true,
  "data": {
    "total_appointments": 1256,
    "no_show_rate": 8.2,
    "no_show_count": 103,
    "completed_count": 987,
    "confirmed_count": 142,
    "waitlist_fills": 24,
    "revenue_saved": 12400
  }
}

// revenue_saved is calculated from your avg_appointment_value setting.`}
            />
          </div>
        </section>

        {/* Error Handling */}
        <section id="errors">
          <h2 className="text-xl font-bold text-gray-900">Error Handling</h2>
          <p className="mt-2 text-sm text-gray-600">
            Standard HTTP status codes. All errors return the same envelope format with an error code and message.
          </p>

          <div className="mt-4 rounded-xl border border-black/[0.06] bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-black/[0.04]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Code</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {[
                  { code: "200", meaning: "Success" },
                  { code: "201", meaning: "Created" },
                  { code: "400", meaning: "Validation error — check the request body" },
                  { code: "401", meaning: "Invalid or missing API key" },
                  { code: "404", meaning: "Resource not found" },
                  { code: "500", meaning: "Server error — contact support" },
                  { code: "502", meaning: "External service failed (e.g. SMS delivery)" },
                ].map(({ code, meaning }) => (
                  <tr key={code}>
                    <td className="px-4 py-2.5">
                      <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{code}</code>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900 mb-2">Error codes in responses</p>
            <div className="rounded-xl border border-black/[0.06] bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-black/[0.04]">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Error Code</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {[
                    { code: "UNAUTHORIZED", meaning: "API key missing, invalid, or expired" },
                    { code: "VALIDATION_ERROR", meaning: "Request body failed schema validation" },
                    { code: "NOT_FOUND", meaning: "Resource does not exist or belongs to another tenant" },
                    { code: "INVALID_STATUS", meaning: "Status transition not allowed" },
                    { code: "DB_ERROR", meaning: "Database operation failed" },
                    { code: "INTERNAL_ERROR", meaning: "Unexpected server error" },
                  ].map(({ code, meaning }) => (
                    <tr key={code}>
                      <td className="px-4 py-2.5">
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{code}</code>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Need help? */}
        <section className="rounded-2xl border border-black/[0.04] bg-gradient-to-br from-blue-50 to-indigo-50 p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900">Need Help Integrating?</h2>
          <p className="mt-2 text-sm text-gray-600">
            Our team helps your developer get set up. Most integrations take under 15 minutes.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <a
              href="mailto:support@noshowzero.com?subject=API%20Integration%20Help"
              className="inline-flex items-center rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Email Support
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/25"
            >
              Back to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

interface EndpointBlockProps {
  readonly method: string;
  readonly path: string;
  readonly description: string;
  readonly requestBody: string | null;
  readonly responseBody: string;
}

function EndpointBlock({ method, path, description, requestBody, responseBody }: EndpointBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const methodColors: Record<string, string> = {
    GET: "bg-green-100 text-green-700",
    POST: "bg-blue-100 text-blue-700",
    PATCH: "bg-amber-100 text-amber-700",
    DELETE: "bg-red-100 text-red-700",
  };

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", methodColors[method] ?? "bg-gray-100 text-gray-700")}>
          {method}
        </span>
        <code className="text-sm font-mono text-gray-700">{path}</code>
        <span className="text-xs text-gray-400 ml-auto mr-2">{description}</span>
        <ChevronRight className={cn("h-4 w-4 text-gray-400 transition-transform", expanded && "rotate-90")} />
      </button>

      {expanded && (
        <div className="border-t border-black/[0.04] px-4 py-4 space-y-4">
          {requestBody && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Request Body</p>
              <CodeBlock language="json" code={requestBody} />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Response</p>
            <CodeBlock language="json" code={responseBody} />
          </div>
        </div>
      )}
    </div>
  );
}
