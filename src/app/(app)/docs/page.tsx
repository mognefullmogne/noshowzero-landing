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
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "https://api.nowshow.com/v1";

interface CodeBlockProps {
  readonly code: string;
  readonly language?: string;
}

function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "quick-start", label: "Quick Start", icon: Zap },
  { id: "authentication", label: "Authentication", icon: Key },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "reminders", label: "Reminders", icon: Bell },
  { id: "waitlist", label: "Waitlist", icon: ListChecks },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "webhooks", label: "Webhooks", icon: Send },
  { id: "errors", label: "Error Handling", icon: Code },
] as const;

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

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
            API Reference
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
        {/* Overview */}
        <section id="overview">
          <h1 className="text-2xl font-bold text-gray-900">NowShow API Documentation</h1>
          <p className="mt-2 text-gray-600 leading-relaxed">
            The NowShow API lets you integrate AI-powered appointment management into your
            existing scheduling software. Reduce no-shows, fill cancellations automatically,
            and send smart reminders — all through a simple REST API.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-black/[0.04] bg-white p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                <Zap className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">REST API</p>
              <p className="mt-1 text-xs text-gray-500">JSON over HTTPS with standard HTTP methods</p>
            </div>
            <div className="rounded-xl border border-black/[0.04] bg-white p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                <Key className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">API Key Auth</p>
              <p className="mt-1 text-xs text-gray-500">Simple header-based authentication</p>
            </div>
            <div className="rounded-xl border border-black/[0.04] bg-white p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
                <Send className="h-4 w-4 text-green-600" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">Webhooks</p>
              <p className="mt-1 text-xs text-gray-500">Real-time event notifications</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
            <p className="text-sm text-blue-800">
              <strong>Base URL:</strong>{" "}
              <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-700 text-xs">{API_BASE}</code>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              All API requests must be made over HTTPS. Requests made over HTTP will be rejected.
            </p>
          </div>
        </section>

        {/* Quick Start */}
        <section id="quick-start">
          <h2 className="text-xl font-bold text-gray-900">Quick Start</h2>
          <p className="mt-2 text-sm text-gray-600">
            Get up and running in 3 steps. You&apos;ll be sending your first AI-powered reminder in under 15 minutes.
          </p>

          <div className="mt-6 space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">1</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Get your API key</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Go to your <a href="/dashboard" className="text-blue-600 underline">Dashboard</a> and
                  click &quot;Generate New Key&quot;. Copy the key — you&apos;ll need it for all API requests.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">2</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Create an appointment</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Register an upcoming appointment so NowShow can track it and send smart reminders.
                </p>
                <div className="mt-3">
                  <CodeBlock language="bash" code={`curl -X POST ${API_BASE}/appointments \\
  -H "X-API-Key: nows_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "patient_name": "John Smith",
    "patient_phone": "+1234567890",
    "patient_email": "john@example.com",
    "provider_name": "Dr. Sarah Chen",
    "scheduled_at": "2026-03-10T14:00:00Z",
    "duration_minutes": 30,
    "type": "checkup"
  }'`} />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">3</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">NowShow handles the rest</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Our AI engine automatically:
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Scores the no-show risk for each appointment
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Sends reminders at the optimal time (WhatsApp, SMS, email)
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Auto-fills cancelled slots from the waitlist
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Authentication */}
        <section id="authentication">
          <h2 className="text-xl font-bold text-gray-900">Authentication</h2>
          <p className="mt-2 text-sm text-gray-600">
            Authenticate every request by including your API key in the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 text-xs">X-API-Key</code> header.
          </p>

          <div className="mt-4">
            <CodeBlock language="bash" code={`curl ${API_BASE}/appointments \\
  -H "X-API-Key: nows_your_key_here"`} />
          </div>

          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-800">Keep your API key secret</p>
            <p className="text-xs text-amber-600 mt-1">
              Never expose your API key in client-side code, public repositories, or browser
              requests. Use server-side code to call the NowShow API.
            </p>
          </div>
        </section>

        {/* Appointments */}
        <section id="appointments">
          <h2 className="text-xl font-bold text-gray-900">Appointments</h2>
          <p className="mt-2 text-sm text-gray-600">
            Create, update, and manage appointments. NowShow will automatically analyze each
            appointment for no-show risk and schedule appropriate reminders.
          </p>

          <div className="mt-6 space-y-8">
            <EndpointBlock
              method="POST"
              path="/appointments"
              description="Create a new appointment"
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
}`}
            />

            <EndpointBlock
              method="GET"
              path="/appointments"
              description="List all appointments with optional filters"
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
              description="Get a single appointment with full details and AI analysis"
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
              description="Update an appointment (reschedule, cancel, mark as no-show)"
              requestBody={`{
  "status": "cancelled",
  "cancellation_reason": "patient_request"
}`}
              responseBody={`{
  "id": "apt_7f3k9x2m",
  "status": "cancelled",
  "waitlist_triggered": true,
  "slot_offered_to": "Jane Doe"
}`}
            />
          </div>
        </section>

        {/* Reminders */}
        <section id="reminders">
          <h2 className="text-xl font-bold text-gray-900">Reminders</h2>
          <p className="mt-2 text-sm text-gray-600">
            Reminders are automatically scheduled when you create an appointment. The AI picks
            the optimal channel (WhatsApp, SMS, email) and timing based on patient behavior patterns.
          </p>

          <div className="mt-6 space-y-8">
            <EndpointBlock
              method="GET"
              path="/appointments/:id/reminders"
              description="List all reminders for an appointment"
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
              description="Manually trigger an additional reminder"
              requestBody={`{
  "channel": "sms",
  "message": "Reminder: Your appointment with Dr. Chen is tomorrow at 2 PM."
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
            The AI waitlist automatically fills cancelled slots by scoring candidates on
            clinical urgency, reliability, time preferences, and distance.
          </p>

          <div className="mt-6 space-y-8">
            <EndpointBlock
              method="POST"
              path="/waitlist"
              description="Add a patient to the waitlist"
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
}`}
            />

            <EndpointBlock
              method="GET"
              path="/waitlist"
              description="List all waitlist entries with AI scores"
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
            Manage your patient/client contacts. NowShow builds a reliability profile
            for each contact over time to improve no-show predictions.
          </p>

          <div className="mt-6 space-y-8">
            <EndpointBlock
              method="POST"
              path="/contacts"
              description="Create or update a contact"
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
}`}
            />
          </div>
        </section>

        {/* Webhooks */}
        <section id="webhooks">
          <h2 className="text-xl font-bold text-gray-900">Webhooks</h2>
          <p className="mt-2 text-sm text-gray-600">
            Receive real-time notifications when important events happen. Configure webhook
            URLs in your dashboard settings.
          </p>

          <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Available Events</p>
            <div className="space-y-2">
              {[
                { event: "appointment.created", desc: "New appointment registered" },
                { event: "appointment.cancelled", desc: "Appointment was cancelled" },
                { event: "appointment.no_show", desc: "Patient didn't show up" },
                { event: "reminder.sent", desc: "Reminder sent to patient" },
                { event: "reminder.delivered", desc: "Reminder confirmed delivered" },
                { event: "waitlist.slot_offered", desc: "Open slot offered to waitlist patient" },
                { event: "waitlist.slot_filled", desc: "Waitlist patient confirmed the slot" },
                { event: "risk.high_detected", desc: "High no-show risk detected for appointment" },
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
            <p className="text-sm font-medium text-gray-900 mb-2">Webhook Payload Example</p>
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
            The API uses standard HTTP status codes. Errors include a message explaining what went wrong.
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
                  { code: "201", meaning: "Resource created" },
                  { code: "400", meaning: "Bad request — check your request body" },
                  { code: "401", meaning: "Unauthorized — invalid or missing API key" },
                  { code: "403", meaning: "Forbidden — insufficient plan tier" },
                  { code: "404", meaning: "Resource not found" },
                  { code: "429", meaning: "Rate limited — slow down requests" },
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

          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900 mb-2">Error Response Format</p>
            <CodeBlock language="json" code={`{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The 'scheduled_at' field must be a future date.",
    "field": "scheduled_at"
  }
}`} />
          </div>

          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
            <p className="text-sm font-medium text-blue-800">Rate Limits</p>
            <p className="text-xs text-blue-600 mt-1">
              Growth: 100 requests/minute | Professional: 500 requests/minute | Enterprise: Unlimited
            </p>
          </div>
        </section>

        {/* Need help? */}
        <section className="rounded-2xl border border-black/[0.04] bg-gradient-to-br from-blue-50 to-indigo-50 p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900">Need Help?</h2>
          <p className="mt-2 text-sm text-gray-600">
            Our team is here to help you integrate NowShow. We respond within 2 hours.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <a
              href="mailto:support@nowshow.com?subject=API%20Integration%20Help"
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
