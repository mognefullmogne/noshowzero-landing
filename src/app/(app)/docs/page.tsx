// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "https://api.noshowzero.com/v1";

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
  { id: "reminders", label: "Reminders", icon: Bell },
  { id: "waitlist", label: "Waitlist", icon: ListChecks },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "webhooks", label: "Webhooks", icon: Send },
  { id: "errors", label: "Error Handling", icon: Settings },
] as const;

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("how-it-works");

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
            {/* Flow diagram */}
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
  // Send the appointment to NowShow — AI handles the rest
  await fetch("${API_BASE}/appointments", {
    method: "POST",
    headers: {
      "X-API-Key": process.env.NOWSHOW_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      patient_name: appointment.clientName,
      patient_phone: appointment.clientPhone,
      patient_email: appointment.clientEmail,
      provider_name: appointment.staffName,
      scheduled_at: appointment.dateTime,
      duration_minutes: appointment.duration,
      type: appointment.serviceType,
    }),
  });
  // That's it! NowShow now:
  // ✓ Scores the no-show risk
  // ✓ Schedules smart reminders (WhatsApp, SMS, email)
  // ✓ Monitors for cancellations
  // ✓ Auto-fills from waitlist if cancelled
}`} />

                  <CodeBlock language="python" code={`# Python version — same idea, goes inside your booking system

import requests, os

def on_appointment_created(appointment):
    """Called automatically when a client books."""
    requests.post(
        "${API_BASE}/appointments",
        headers={
            "X-API-Key": os.environ["NOWSHOW_API_KEY"],
            "Content-Type": "application/json",
        },
        json={
            "patient_name": appointment["client_name"],
            "patient_phone": appointment["client_phone"],
            "patient_email": appointment["client_email"],
            "provider_name": appointment["staff_name"],
            "scheduled_at": appointment["date_time"],
            "duration_minutes": appointment["duration"],
            "type": appointment["service_type"],
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

async function onAppointmentCancelled(appointmentId, reason) {
  const response = await fetch(
    \`${API_BASE}/appointments/\${appointmentId}\`,
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

  const result = await response.json();
  // result.waitlist_triggered = true
  // result.slot_offered_to = "Jane Doe"
  // → NowShow already texted Jane to offer her the slot!
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
            This is set up once in your software&apos;s configuration.
          </p>

          <div className="mt-4">
            <CodeBlock language="javascript" code={`// Set your API key once in your app's config
const NOWSHOW_API_KEY = process.env.NOWSHOW_API_KEY;

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
              description="Send a new appointment to NowShow"
              requestBody={`{
  "patient_name": "John Smith",
  "patient_phone": "+1234567890",
  "patient_email": "john@example.com",
  "provider_name": "Dr. Sarah Chen",
  "scheduled_at": "2026-03-10T14:00:00Z",
  "duration_minutes": 30,
  "type": "checkup",
  "location_id": "loc_abc123"
}`}
              responseBody={`{
  "id": "apt_7f3k9x2m",
  "status": "confirmed",
  "risk_score": 0.23,
  "risk_level": "low",
  "reminders_scheduled": [
    { "channel": "whatsapp", "send_at": "2026-03-09T10:00:00Z" },
    { "channel": "sms", "send_at": "2026-03-10T08:00:00Z" }
  ],
  "created_at": "2026-03-03T12:00:00Z"
}

→ NowShow immediately scheduled 2 reminders
→ Risk score 0.23 = low risk, standard reminders`}
            />

            <EndpointBlock
              method="GET"
              path="/appointments"
              description="List appointments (with filters)"
              requestBody={null}
              responseBody={`{
  "data": [...],
  "total": 156,
  "page": 1,
  "limit": 50
}

Query params:
  ?status=confirmed|cancelled|completed|no_show
  ?from=2026-03-01&to=2026-03-31
  ?provider=Dr. Sarah Chen
  ?page=1&limit=50`}
            />

            <EndpointBlock
              method="GET"
              path="/appointments/:id"
              description="Get full details + AI analysis for one appointment"
              requestBody={null}
              responseBody={`{
  "id": "apt_7f3k9x2m",
  "patient_name": "John Smith",
  "provider_name": "Dr. Sarah Chen",
  "scheduled_at": "2026-03-10T14:00:00Z",
  "status": "confirmed",
  "risk_score": 0.23,
  "risk_level": "low",
  "risk_factors": {
    "history_score": 0.9,
    "timing_score": 0.7,
    "recency_score": 0.8
  },
  "reminders": [...]
}`}
            />

            <EndpointBlock
              method="PATCH"
              path="/appointments/:id"
              description="Cancel or reschedule (triggers waitlist)"
              requestBody={`{
  "status": "cancelled",
  "cancellation_reason": "patient_request"
}`}
              responseBody={`{
  "id": "apt_7f3k9x2m",
  "status": "cancelled",
  "waitlist_triggered": true,
  "slot_offered_to": "Jane Doe"
}

→ Slot was instantly offered to the top waitlist match`}
            />
          </div>
        </section>

        {/* Reminders */}
        <section id="reminders">
          <h2 className="text-xl font-bold text-gray-900">Reminders</h2>
          <p className="mt-2 text-sm text-gray-600">
            Reminders are <strong>100% automatic</strong>. When you send an appointment to NowShow,
            the AI picks the best channel and timing. You can also check reminder status or manually
            trigger extras if needed.
          </p>

          <div className="mt-6 space-y-4">
            <EndpointBlock
              method="GET"
              path="/appointments/:id/reminders"
              description="Check reminder status for an appointment"
              requestBody={null}
              responseBody={`{
  "data": [
    {
      "id": "rem_abc123",
      "channel": "whatsapp",
      "status": "delivered",
      "sent_at": "2026-03-09T10:00:00Z",
      "delivered_at": "2026-03-09T10:00:05Z",
      "read_at": "2026-03-09T10:15:00Z"
    },
    {
      "id": "rem_def456",
      "channel": "sms",
      "status": "scheduled",
      "send_at": "2026-03-10T08:00:00Z"
    }
  ]
}`}
            />

            <EndpointBlock
              method="POST"
              path="/appointments/:id/reminders"
              description="Manually send an extra reminder (optional)"
              requestBody={`{
  "channel": "sms",
  "message": "Reminder: Your appointment is tomorrow at 2 PM."
}`}
              responseBody={`{
  "id": "rem_ghi789",
  "channel": "sms",
  "status": "queued",
  "send_at": "2026-03-03T12:05:00Z"
}`}
            />
          </div>
        </section>

        {/* Waitlist */}
        <section id="waitlist">
          <h2 className="text-xl font-bold text-gray-900">Waitlist</h2>
          <p className="mt-2 text-sm text-gray-600">
            Add clients to the waitlist, and the AI automatically fills cancelled slots by scoring
            candidates on urgency, reliability, time preferences, and distance — no manual matching needed.
          </p>

          <div className="mt-6 space-y-4">
            <EndpointBlock
              method="POST"
              path="/waitlist"
              description="Add someone to the waitlist"
              requestBody={`{
  "patient_name": "Jane Doe",
  "patient_phone": "+1987654321",
  "patient_email": "jane@example.com",
  "preferred_providers": ["Dr. Sarah Chen"],
  "preferred_times": ["morning", "afternoon"],
  "urgency": "medium",
  "appointment_type": "followup"
}`}
              responseBody={`{
  "id": "wl_xyz789",
  "status": "active",
  "smart_score": 78,
  "position": 3,
  "created_at": "2026-03-03T12:00:00Z"
}

→ AI scored this entry 78/100 (position #3)
→ When a slot opens, higher scores get offered first`}
            />

            <EndpointBlock
              method="GET"
              path="/waitlist"
              description="See all waitlisted clients with AI scores"
              requestBody={null}
              responseBody={`{
  "data": [
    {
      "id": "wl_xyz789",
      "patient_name": "Jane Doe",
      "smart_score": 78,
      "urgency": "medium",
      "status": "active"
    }
  ],
  "total": 12
}`}
            />
          </div>
        </section>

        {/* Contacts */}
        <section id="contacts">
          <h2 className="text-xl font-bold text-gray-900">Contacts</h2>
          <p className="mt-2 text-sm text-gray-600">
            NowShow automatically builds a reliability profile for each client over time.
            The more appointments they have, the better the AI predicts their no-show risk.
          </p>

          <div className="mt-6">
            <EndpointBlock
              method="POST"
              path="/contacts"
              description="Create or update a client profile"
              requestBody={`{
  "name": "John Smith",
  "phone": "+1234567890",
  "email": "john@example.com",
  "tags": ["regular", "morning-preferred"]
}`}
              responseBody={`{
  "id": "ct_abc123",
  "name": "John Smith",
  "reliability_score": 0.85,
  "total_appointments": 12,
  "no_shows": 1,
  "created_at": "2026-01-15T10:00:00Z"
}

→ 85% reliability (1 no-show out of 12 visits)
→ AI uses this to calibrate reminder intensity`}
            />
          </div>
        </section>

        {/* Webhooks */}
        <section id="webhooks">
          <h2 className="text-xl font-bold text-gray-900">Webhooks</h2>
          <p className="mt-2 text-sm text-gray-600">
            NowShow can notify your software in real-time when things happen — like a reminder
            being delivered, a slot being filled, or a high-risk appointment detected. Your software
            receives these events automatically (no polling needed).
          </p>

          <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Events NowShow sends to you</p>
            <div className="space-y-2">
              {[
                { event: "appointment.created", desc: "New appointment registered" },
                { event: "appointment.cancelled", desc: "Appointment was cancelled" },
                { event: "appointment.no_show", desc: "Client didn't show up" },
                { event: "reminder.sent", desc: "Reminder sent to client" },
                { event: "reminder.delivered", desc: "Reminder confirmed delivered" },
                { event: "waitlist.slot_offered", desc: "Open slot offered to waitlist client" },
                { event: "waitlist.slot_filled", desc: "Waitlist client confirmed the slot" },
                { event: "risk.high_detected", desc: "High no-show risk detected" },
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

          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900 mb-2">Example: Your software receives this when a waitlist slot is filled</p>
            <CodeBlock language="json" code={`{
  "event": "waitlist.slot_filled",
  "timestamp": "2026-03-03T14:30:00Z",
  "data": {
    "appointment_id": "apt_7f3k9x2m",
    "waitlist_entry_id": "wl_xyz789",
    "patient_name": "Jane Doe",
    "provider_name": "Dr. Sarah Chen",
    "scheduled_at": "2026-03-10T14:00:00Z",
    "smart_score": 78
  }
}`} />
          </div>
        </section>

        {/* Error Handling */}
        <section id="errors">
          <h2 className="text-xl font-bold text-gray-900">Error Handling</h2>
          <p className="mt-2 text-sm text-gray-600">
            Standard HTTP status codes. Your developer handles these once during setup.
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
                  { code: "400", meaning: "Bad request — check the request body" },
                  { code: "401", meaning: "Invalid or missing API key" },
                  { code: "403", meaning: "Feature not available on your plan" },
                  { code: "404", meaning: "Not found" },
                  { code: "429", meaning: "Too many requests — slow down" },
                  { code: "500", meaning: "Server error — contact support" },
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

          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
            <p className="text-sm font-medium text-blue-800">Rate Limits</p>
            <p className="text-xs text-blue-600 mt-1">
              Growth: 100 req/min | Professional: 500 req/min | Enterprise: Unlimited
            </p>
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
