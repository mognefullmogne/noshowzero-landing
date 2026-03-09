# Architecture

**Analysis Date:** 2026-03-09

## Pattern Overview

**Overall:** Next.js 15 server-and-client hybrid with domain-driven service layer organization

**Key Characteristics:**
- Next.js App Router (directory-based routing)
- Client and server components coexisting in same feature routes
- Supabase as primary data layer (PostgreSQL + Auth + Realtime)
- Service modules in `src/lib/` organized by business domain
- Feature-scoped UI components with shared `components/ui` library
- API routes with tenant-scoped data access
- Claude AI integration for decision-making, analysis, and operator assistance
- Twilio for WhatsApp + SMS messaging (Content Templates for outside 24h window)
- Stripe for subscription billing
- Cron jobs for background processing (confirmations, escalation, no-show detection, sync)

## Layers

**API Routes (Route Handlers):**
- Purpose: HTTP request handlers following Next.js 15 conventions
- Location: `src/app/api/`
- Contains: Endpoint definitions, request validation, response serialization
- Depends on: Supabase clients, auth helpers, lib service modules
- Used by: Frontend fetch calls, external webhooks, cron jobs, public API (`/api/v1/`)

**AI Decision Layer:**
- Purpose: Strategic reasoning, pattern analysis, operator assistance, patient understanding
- Location: `src/lib/ai/`
- Contains: Decision engine, operator chat (agentic loop), patient memory, morning briefing, no-show analysis, smart rebook
- Depends on: Anthropic SDK (Claude Sonnet 4.6, Haiku 4.5), Supabase, scoring modules
- Used by: Backfill orchestrator, cron jobs, operator chat API, webhook handlers

**Business Logic Services:**
- Purpose: Domain-specific operations (appointments, optimization, messaging, etc.)
- Location: `src/lib/` (subdirectories by domain: `booking/`, `backfill/`, `confirmation/`, `scoring/`, `intelligence/`, `optimization/`, etc.)
- Contains: Pure functions, orchestrators, helpers
- Depends on: Supabase client, types, AI layer, other lib modules
- Used by: API routes, cron jobs, frontend hooks

**Data Access Layer:**
- Purpose: Abstraction over Supabase queries
- Location: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
- Contains: Client/server Supabase client factories, service role client for privileged operations
- Depends on: Supabase SDK
- Used by: Business logic, API routes, hooks

**UI Components:**
- Purpose: React components for rendering UI
- Location: `src/components/` (organized by feature: `appointments/`, `dashboard/`, `offers/`, etc.)
- Contains: Server and client components, hooks, styling
- Depends on: `components/ui` primitives, hooks, lib utilities
- Used by: Page files in `src/app/(app)/`

**Pages (Page Components):**
- Purpose: Route entry points and page-level composition
- Location: `src/app/(app)/[feature]/page.tsx` for authenticated, `src/app/(auth)/[action]/page.tsx` for public
- Contains: Client/server components, data fetching, layout
- Depends on: Components, hooks, API routes
- Used by: Next.js App Router

**Authentication & Tenancy:**
- Purpose: Auth enforcement, tenant scoping, session management
- Location: `src/middleware.ts`, `src/lib/auth-helpers.ts`, `src/lib/supabase/middleware.ts`, `src/hooks/use-tenant.ts`
- Contains: Middleware, tenant helpers, hooks
- Depends on: Supabase auth, cookies
- Used by: All protected routes, API handlers

## Data Flow

**Appointment Creation Flow:**

1. User fills form in `src/app/(app)/appointments/page.tsx` (client component)
2. Form validation via `InlineCreateAppointmentSchema` from `src/lib/validations.ts`
3. POST to `src/app/api/appointments/route.ts`
4. Route handler:
   - Authenticates tenant via `getAuthenticatedTenant()` from `src/lib/auth-helpers.ts`
   - Parses request body with Zod schema
   - Checks provider conflict via `checkProviderConflict()` (prevents double-booking)
   - Upserts or finds patient via Supabase
   - Creates appointment record with initial status `scheduled`
   - Calls `computeRiskScore()` from `src/lib/scoring/risk-score.ts`
   - Calls `generateContactSchedule()` from `src/lib/scoring/contact-timing.ts`
   - Calls `scheduleToReminders()` to create reminder records
   - Sends immediate notification via WhatsApp Content Template
   - Calls `createConfirmationWorkflow()` from `src/lib/confirmation/workflow.ts`
   - Returns JSON response
5. Frontend receives response, updates local state, refetches list

**3-Touch Confirmation Escalation Flow:**

1. **Touch 1 — WhatsApp Confirmation (48h before):**
   - Cron `send-confirmations` (every 5 min) picks up `pending_send` / `notification_sent` workflows past deadline
   - Sends WhatsApp SI/NO confirmation via Content Template
   - Transitions state to `message_sent`, sets deadline = now + 24h
   - If patient responds SI → `confirmed`; NO → `declined` + triggers backfill

2. **Touch 2 — SMS Reminder (24h before):**
   - Cron `escalate-confirmations` calls `escalateToTouch2()`
   - Finds `message_sent` workflows where appointment is within 24h and no response
   - Sends SMS reminder via `sendMessage()`
   - Transitions state to `reminder_sent`, sets deadline = appointment - 6h

3. **Touch 3 — Final Warning (6h before):**
   - Same cron calls `escalateToTouch3()`
   - Finds `reminder_sent` workflows where appointment is within 6h
   - Sends final ⚠️ warning message
   - Transitions state to `final_warning_sent`, sets deadline = now + 2h

4. **Timeout → Cascade:**
   - Same cron calls `escalateToTimeout()`
   - Finds `final_warning_sent` workflows past deadline with no response
   - Marks `timed_out`
   - Triggers cascade backfill to fill the slot from waitlist

**AI-Driven Backfill Cascade Flow:**

1. Trigger: Cancellation, no-show detection, or confirmation timeout
2. `triggerBackfill()` in `src/lib/backfill/trigger-backfill.ts` orchestrates:
   - Calls `decideStrategy()` (AI Decision Engine) to choose approach
   - Checks for prequalified candidates via `getPrequalifiedCandidates()`
   - Falls back to `findCandidates()` with smart scoring
   - AI re-ranks candidates via `aiRerankCandidates()` (optional)
   - Sends offer(s) based on strategy (single cascade, parallel blast, etc.)
   - Creates offer records with HMAC token hash and expiry
   - Smart rebook: offers cancelling patient alternative slots
3. Patient receives WhatsApp/SMS with accept/decline links
4. Accept: `processAccept()` creates new appointment, marks slot filled
5. Decline: Cascade to next candidate (up to MAX_OFFERS_PER_SLOT = 10)

**Waitlist Optimization Flow:**

1. Gap fill triggered by:
   - Scheduled cron: `src/app/api/cron/run-optimization/route.ts` (every 6h)
   - Manual API call: `src/app/api/optimization/run/route.ts`
2. Calls orchestrator from `src/lib/optimization/calendar-optimizer.ts`
3. Orchestrator:
   - Finds cancelled/no-show appointments
   - Locates available slots via `src/lib/optimization/slot-management.ts`
   - Finds waitlist candidates via `src/lib/backfill/find-candidates.ts`
   - Scores candidates using smart scoring in `src/lib/scoring/smart-score.ts` (includes urgency, reliability, time preference, waiting time, distance, provider match, payment match)
   - Flags high-risk appointments for proactive reschedule
   - Prequalifies critical-risk for backfill cascade
   - Generates offers via `src/lib/backfill/send-offer.ts`
4. Webhook: `src/app/api/webhooks/twilio/route.ts` detects response intent
5. Offer acceptance: `processAccept()` creates new appointment

**Conversational Booking Flow (WhatsApp/SMS):**

1. Patient sends message with booking intent → Twilio webhook
2. `handleBookingMessage()` in `src/lib/booking/booking-orchestrator.ts`
3. States: `awaiting_name` → `awaiting_service` → `awaiting_date` → `awaiting_slot_selection` → `completed`
4. Sessions stored in `booking_sessions` table with 30-min expiry
5. Date parsing: Claude Haiku converts Italian natural language ("lunedì prossimo") → YYYY-MM-DD
6. Slot selection: `findAvailableSlotsAnnotated()` enriches slots with historical risk labels
7. Appointment creation: atomic slot claim, provider conflict check, risk score, reminders, confirmation workflow
8. Max 3 retries per step, all messages in Italian

**Inbound Message Routing:**

1. Twilio webhook receives WhatsApp/SMS → `src/app/api/webhooks/twilio/route.ts`
2. Validates signature, rate limits (10 msgs/60s per phone), sanitizes input
3. Maps button payloads: `accept` → `confirm`, `decline` → `cancel`
4. Classifies intent via regex patterns, then AI fallback (Haiku) for `unknown` intents
5. Routes to handler via `src/lib/webhooks/message-router.ts`:
   - `confirm` → Update appointment to `confirmed`
   - `cancel` → Update to `cancelled`, trigger backfill cascade
   - `accept_offer` / `decline_offer` → Process offer response
   - `slot_select` → Patient selects from proposed slots
   - `join_waitlist` → Create waitlist entry
   - `reschedule` → Generate rebook suggestions via Smart Rebook
   - `book_appointment` → Redirect to booking orchestrator
   - `question` / `unknown` → AI generates contextual Italian reply (Haiku)
6. Fire-and-forget: patient memory update, response pattern recording

**State Management:**

- **Session**: Supabase Auth (stored in cookies, managed by middleware)
- **Tenant**: Per-request via `getAuthenticatedTenant()` or per-hook via `useTenant()`
- **Page State**: React useState for client components (appointments list, filters, pagination)
- **Background Polling**: 30-second intervals with visibility check in `src/app/(app)/appointments/page.tsx`
- **Realtime**: Supabase Realtime subscriptions for live updates (appointments)
- **Database State**: Source of truth for all persistent data (appointments, reminders, offers, etc.)

## Key Abstractions

**Appointment Lifecycle:**

- Defined in `src/lib/types.ts`: `AppointmentStatus` enum
- Transitions validated in `VALID_TRANSITIONS` map
- Statuses: `scheduled` → `reminder_pending` → `reminder_sent` → `confirmed`/`declined`/`timeout` → `completed`/`no_show`/`cancelled`
- Each transition triggered by API route or cron job

**Confirmation Workflow States:**

- Defined in `src/lib/types.ts`: `ConfirmationState` type
- Full state machine: `pending_send` → `notification_sent` → `message_sent` → `reminder_sent` → `final_warning_sent` → `confirmed` | `declined` | `timed_out` | `cancelled`
- `pending_send`: Created on appointment creation, awaiting first send
- `notification_sent`: Initial booking notification sent (no SI/NO)
- `message_sent`: Touch 1 — WhatsApp SI/NO confirmation sent
- `reminder_sent`: Touch 2 — SMS reminder sent (24h before)
- `final_warning_sent`: Touch 3 — Final warning sent (6h before)
- Terminal states: `confirmed`, `declined`, `timed_out`, `cancelled`
- Deadline adjusted by risk tier: critical=72h, high=48h, medium=36h, low=24h before appointment

**AI Decision Engine:**

- Purpose: Choose optimal slot-filling strategy when cancellation/no-show occurs
- Location: `src/lib/ai/decision-engine.ts`
- Model: Claude Sonnet 4.6 (temperature=0, 5s timeout)
- Strategies:
  - `cascade`: Sequential offers, one at a time (default)
  - `rebook_first`: Offer cancelling patient alternative slots before waitlist
  - `parallel_blast`: Send to multiple candidates simultaneously (urgent slots)
  - `wait_and_cascade`: Delay before cascading (slot is far out, few candidates)
  - `manual_review`: Flag for human decision (complex situation)
- Also decides: `parallelCount` (1-5), `expiryMinutes`, `contactChannel` (whatsapp/sms/best_for_patient), `rebookCancellingPatient` flag
- Rule-based fallback if AI unavailable: <1h=urgent blast, <4h=semi-urgent, cancellation+reliable=rebook first, >48h+few candidates=wait
- Context inputs: appointment details, patient history, slot analysis, candidate pool, tenant stats, patient memory

**Operator Chat (Agentic Loop):**

- Purpose: Natural language clinic management via AI assistant
- Location: `src/lib/ai/operator-chat.ts`
- Model: Claude Sonnet 4.6 (max 10 tool iterations)
- System prompt: Italian, responds in Italian
- 10 tools registered in `src/lib/ai/tool-registry.ts`:
  1. `search_appointments` — Query by name, date, status (max 20 results)
  2. `get_appointment_details` — Full appointment + reminders + offers
  3. `reschedule_appointment` — Cancel old, create new at different time
  4. `cancel_appointment` — Cancel + trigger cascade backfill
  5. `find_available_slots` — Query slot table by date range + provider
  6. `send_message_to_patient` — Send WhatsApp/SMS via sendMessage
  7. `get_patient_info` — Patient details + appointment history + stats
  8. `check_waitlist` — List waitlist entries, filtered, sorted by smart_score
  9. `add_to_waitlist` — Add patient to waitlist for a service
  10. `get_calendar_overview` — Weekly calendar breakdown by day + provider + utilization %
- Exposed via: POST `/api/ai/chat` (auth required)
- UI: `src/app/(app)/ai-chat/page.tsx` with suggested prompts, tool call display, markdown rendering

**Patient Memory:**

- Purpose: Extract and store patient preferences from WhatsApp conversations
- Location: `src/lib/ai/patient-memory.ts`
- Model: Claude Haiku 4.5 (extraction only)
- Extracts: preferred times, days, provider, language style
- Storage: `patients.response_patterns.memory` (JSONB), rolling window of 20 facts
- Fire-and-forget: errors logged, never thrown
- Skips: low-confidence messages (<0.7), mechanical intents (confirm/decline)
- Used by: Decision engine (strategy context), operator chat (patient context)

**Morning Briefing:**

- Purpose: Daily Italian briefing for clinic staff — KPIs, high-risk patients, cascade status, trends
- Location: `src/lib/ai/morning-briefing.ts`
- Model: Claude Sonnet 4.6
- Sections: Buongiorno (key numbers), Attenzione (at-risk patients), Cascade (active offers), Ieri (yesterday metrics), Azioni AI (automated actions)
- 1-hour in-memory cache per tenant + date
- Falls back to simple template if AI unavailable

**No-Show Analysis:**

- Purpose: Root cause analysis of 90-day no-show patterns with actionable insights
- Location: `src/lib/ai/no-show-analysis.ts`
- Model: Claude Sonnet 4.5 (1500 tokens)
- Analyzes: by day-of-week, hour, provider, service, lead-time bucket, repeat offenders (3+ no-shows)
- Output: Top 3 root causes, at-risk patients, temporal patterns, 3 actionable recommendations (Italian)
- 24-hour in-memory cache per tenant
- Falls back to deterministic analysis if no API key

**Smart Rebook:**

- Purpose: When a patient cancels, offer alternative slots via WhatsApp
- Location: `src/lib/ai/smart-rebook.ts`
- No AI model (rule-based): finds 3 calendar gaps in next 7 business days (9am-6pm, excluding weekends)
- Creates `slot_proposals` DB entry so patient can respond 1/2/3
- Falls back to waitlist-only offer if no slots available
- Times displayed in Europe/Rome timezone

**Smart Scoring System:**

- Purpose: Rank waitlist candidates for slot offers
- Location: `src/lib/scoring/smart-score.ts`
- Inputs: Urgency, reliability (past show rate), time preference match, waiting time, distance, provider match, payment match
- Output: Weighted score (0-100) + breakdown in `SmartScoreBreakdown` type
- Used by: `src/lib/backfill/find-candidates.ts`, optimization routes

**Risk Scoring:**

- Purpose: Predict no-show probability for an appointment (0-100)
- Location: `src/lib/scoring/risk-score.ts`
- Deterministic, no AI: Components — history (0-40), dayOfWeek (0-15), hour (0-15), leadTime (0-30)
- Europe/Rome timezone for day/hour calculations
- Used on appointment creation, auto-scored by background process

**Response Pattern Learning:**

- Purpose: Learn patient response behavior to optimize contact timing
- Location: `src/lib/intelligence/response-patterns.ts`
- Tracks: channel used, sent/responded timestamps, rolling window of 50 records
- Computes: best channel (WhatsApp vs SMS), best hour of day, avg response time
- Requires 3+ data points before trusting; falls back to defaults (WhatsApp, 10am, 30min)

**Slot Recommendations:**

- Purpose: Analyze historical attendance by slot pattern (day + hour) to guide scheduling
- Location: `src/lib/intelligence/slot-recommendations.ts`
- Fetches 2000 completed/no_show appointments for pattern analysis
- Output: slots ranked by attendance, risk labels ("Alta frequenza" / "Bassa frequenza" / "Nella media")
- Confidence: "alta" (20+ samples), "media" (10+), "bassa" (<10)
- `annotateSlots()`: Enriches available slots with historical risk data (used by booking orchestrator)

**Overbooking Intelligence:**

- Purpose: Suggest overbooking slots with historically high no-show rates
- Location: `src/lib/intelligence/overbooking.ts`
- Threshold: recommends overbooking when no-show rate >= 30% with >= 10 samples
- Confidence: "alta" if 20+ samples, "media" if 10+
- Output: Italian recommendation text with suggested extra appointment count
- Informational only — staff decides whether to act

**No-Show Detection:**

- Purpose: Automatically mark overdue appointments as no-shows
- Location: `src/lib/intelligence/no-show-detector.ts`
- Scans appointments 15+ min past start time with status confirmed/scheduled
- Atomic marking with WHERE guard to prevent double-marking
- Logs to audit_log, triggers cascade backfill for each detected no-show
- Batch limit: 50 per run

**Booking Session:**

- Purpose: Stateful conversational booking via WhatsApp/SMS
- Location: `src/lib/booking/` modules
- States: `awaiting_name` → `awaiting_service` → `awaiting_date` → `awaiting_slot_selection` → `completed`/`abandoned`/`expired`
- Orchestrated by: `src/lib/booking/booking-orchestrator.ts`
- Triggered by: Twilio webhook when booking intent detected
- Expires after 30 min, max 3 retries per step

**Message Intent Detection:**

- Purpose: Parse patient responses to infer booking/offer actions
- Types in `src/lib/types.ts`: `MessageIntent` enum (confirm, cancel, accept_offer, decline_offer, slot_select, book_appointment, join_waitlist, reschedule, question, unknown)
- Sources: Regex patterns first, then AI classification (Haiku) for unknown intents with >0.6 confidence
- Used by: Webhooks, confirmation workflow, booking orchestrator

**Operators & Services Management:**

- Purpose: Manage clinic staff and service catalog
- API: `/api/operators` (GET, POST), `/api/operators/[id]` (PATCH, DELETE), `/api/operators/[id]/services` (manage operator-service assignments)
- API: `/api/services` (GET, POST), `/api/services/[id]` (PATCH, DELETE)
- Tables: `operators` (name, role, phone, email, is_active), `services` (name, description, duration_min, price, currency, is_active), `operator_services` (many-to-many join)
- UI: `src/app/(app)/organizzazione/page.tsx` — dual-panel management of operators + services with create/edit/delete dialogs
- Used by: Booking flow (service selection), operator chat (find_available_slots), calendar overview

## Entry Points

**Web App Root:**
- Location: `src/app/layout.tsx`
- Triggers: Browser requests to `/`
- Responsibilities: SEO metadata, font loading, global styles, layout wrapper

**App Layout:**
- Location: `src/app/(app)/layout.tsx`
- Triggers: Authenticated requests to `/dashboard`, `/appointments`, etc.
- Responsibilities: Tenant check, sidebar navigation, auth enforcement, onboarding redirect

**App Pages:**

| Page | Location | Purpose |
|------|----------|---------|
| Dashboard | `(app)/dashboard` | Onboarding checklist, API key management, trial banner, quick links |
| Appointments | `(app)/appointments` | Realtime appointment table, status/date filters, create dialog, 30s polling |
| Analytics | `(app)/analytics` | KPI cards (no-show rate, slot recovery, revenue saved), offer metrics, date range filters |
| Waitlist | `(app)/waitlist` | Waitlist entries table, status filter, create dialog |
| Offers | `(app)/offers` | Backfill offers table, summary stats, auto-refresh 30s |
| Messages | `(app)/messages` | Dual-pane message interface (thread list + conversation), send/receive SMS & WhatsApp |
| Integrations | `(app)/integrations` | Calendar connectors (Google, Outlook, iCal, CSV), sync controls, import history |
| Rules | `(app)/rules` | Business rule templates (6 pre-built), custom rule builder (if/then), toggle active/pause |
| AI Chat | `(app)/ai-chat` | Operator AI chat with tool calls, suggested prompts (Italian), markdown rendering |
| Optimization | `(app)/optimization` | Calendar optimization proposals (gap fill, reschedule, swap, load balance), approve/reject |
| Strategy Log | `(app)/strategy-log` | AI backfill strategy decisions, KPI summary, filterable by action type, expandable reasoning |
| Organizzazione | `(app)/organizzazione` | Operators + services management (CRUD), operator-service assignments |
| Settings | `(app)/settings` | Profile, clinic settings (avg appointment value), password change |
| Billing | `(app)/billing` | Stripe subscription management |
| Audit | `(app)/audit` | Immutable audit trail, entity/actor type filters, metadata expansion |
| Calendar | `(app)/calendar` | Calendar view of appointments |
| Onboarding | `(app)/onboarding` | 3-step tenant setup wizard |
| Docs | `(app)/docs` | API documentation |

**API Handler:**
- Location: `src/app/api/[feature]/route.ts`
- Triggers: HTTP requests to `/api/` endpoints
- Responsibilities: Auth, request validation, business logic invocation, response formatting

**Public API:**
- Location: `src/app/api/v1/`
- Endpoints: patients, appointments, analytics (API key authenticated)

**Webhook Receiver:**
- Location: `src/app/api/webhooks/twilio/route.ts`
- Triggers: Incoming SMS/WhatsApp from Twilio
- Responsibilities: Signature verification, rate limiting, intent classification, dispatch to booking/confirmation/offer/rebook handlers, TwiML response

**Cron Jobs:**

| Job | Route | Interval | Purpose |
|-----|-------|----------|---------|
| Send Confirmations | `cron/send-confirmations` | 5 min | Touch 1: Send SI/NO confirmation for pending workflows |
| Escalate Confirmations | `cron/escalate-confirmations` | cron | Touch 2/3 + timeout: Escalate through reminder ladder |
| Process Reminders | `cron/process-reminders` | 15 min | Send pending reminders via WhatsApp/SMS |
| Detect No-Shows | `cron/detect-no-shows` | 15 min | Mark overdue appointments as no_show, trigger cascade |
| Sync Calendars | `cron/sync-calendars` | 15 min | Delta sync all active integrations (Google, Outlook, iCal) |
| Run Optimization | `cron/run-optimization` | 6 hours | Calendar optimization, proactive reschedule, prequalify cascade |
| Check Timeouts | `cron/check-timeouts` | cron | Expire pending confirmation workflows past deadline |
| Expire Offers | `cron/expire-offers` | cron | Expire pending offers past `expires_at` |
| Cleanup Proposals | `cron/cleanup-proposals` | cron | Remove expired slot proposals |
| KPI Snapshot | `cron/kpi-snapshot` | cron | Snapshot KPI metrics to `kpi_snapshots` table |

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every request before route handler
- Responsibilities: Auth session refresh, cookie management, redirect unauthenticated users, redirect authenticated users away from auth pages

## AI Model Usage

| Component | Model | Purpose | Fallback |
|-----------|-------|---------|----------|
| Decision Engine | Claude Sonnet 4.6 | Strategic slot-filling strategy | Rule-based (time thresholds) |
| Operator Chat | Claude Sonnet 4.6 | Agentic loop, 10 tools, Italian | — |
| Morning Briefing | Claude Sonnet 4.6 | Daily KPI briefing | Simple template |
| No-Show Analysis | Claude Sonnet 4.5 | Root cause analysis | Deterministic analysis |
| Patient Memory | Claude Haiku 4.5 | Extract preferences from messages | — (fire-and-forget) |
| Date Parser | Claude Haiku 4.5 | Italian date NLP ("lunedì prossimo") | null (parsing failure) |
| Intent Classification | Claude Haiku 4.5 | Classify unknown message intents | Regex patterns |
| SMS Personalizer | Claude Haiku 4.5 | Personalize confirmation tone | Standard template |
| Candidate Ranker | Claude (via ai-candidate-ranker) | Re-rank waitlist candidates | Smart score ordering |
| Website Chatbot | Claude Haiku 4.5 | Answer visitor questions | Rule-based responses |

## Error Handling

**Strategy:** Try-catch at route handler level with structured JSON responses

**Patterns:**

- **Request Validation Errors:** Return 400 with `{ success: false, error: { code: "VALIDATION_ERROR", message: "..." } }`
- **Auth Errors:** Return 401 with `{ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }`
- **Not Found:** Return 404 with `{ success: false, error: { code: "NOT_FOUND", message: "..." } }`
- **Server Errors:** Return 500 with `{ success: false, error: { code: "INTERNAL_ERROR", message: "..." } }` after logging
- **Database Errors:** Logged to console, returned as 500 with generic message
- **Webhook Failures:** Logged but gracefully handled (no crash), returns TwiML
- **AI Failures:** All AI calls have rule-based fallbacks; patient memory is fire-and-forget

## Cross-Cutting Concerns

**Logging:**
- Tool: `console.error()` for errors, `console.log()` for debug
- Patterns: Log errors with context at API routes and service functions

**Validation:**
- Tool: Zod schema validation
- Patterns: Define schema in `src/lib/validations.ts`, parse with `.safeParse()`, return 400 on failure

**Authentication:**
- Tool: Supabase Auth (Google OAuth + email/password + session cookies)
- Patterns: `getAuthenticatedTenant()` for API routes, `useTenant()` for client components
- API keys: `/api/v1/` endpoints authenticated via API key header
- Cron: Protected by `CRON_SECRET` env var
- Enforced by: Middleware (`src/middleware.ts`), route guards in pages

**Tenancy:**
- Pattern: Scope all queries by `tenant_id`
- Enforced by: `getAuthenticatedTenant()` returns tenant ID, included in every Supabase query

**Security:**
- Twilio webhook signature verification (`X-Twilio-Signature`)
- Stripe webhook signature verification
- HMAC token verification for offer accept/decline links
- Rate limiting: Twilio webhook (10 msgs/60s per phone), Chat (20 req/60s by IP) — in-memory, resets per instance
- Input sanitization: control characters stripped, AI inputs capped
- XSS protection: `escapeHtml()` on HTML responses, CSP headers
- Phone format validation: E.164 pattern check
- Parameterized queries: all Supabase queries use `.eq()`, `.in()`, etc.
- OAuth state tokens for calendar integration flows
- Token encryption for stored calendar credentials

**Immutability:**
- Pattern: All types in `src/lib/types.ts` use `readonly` on fields
- Applied to: Database row types, API responses, type parameters
- Enforced by: TypeScript strict mode

**Type Safety:**
- Tool: TypeScript 5 with strict mode
- Patterns: Explicit types on all data structures, Zod for runtime validation
- `src/lib/types.ts` defines 50+ interfaces covering all domain entities

**Localization:**
- All patient-facing messages in Italian
- All AI system prompts produce Italian output
- Timezone: Europe/Rome throughout

**Messaging:**
- WhatsApp uses Twilio Content Templates (Meta-approved) outside 24h conversation window
- SMS fallback: WhatsApp failure → retry as SMS (strips Content SID)
- Retry: 3 attempts max with 3x exponential backoff (1s → 3s → 9s)
- Templates: appointment_notification, appointment_confirmation, backfill_offer, appointment_reminder, confirmation_reminder
- Messaging Service SID: `MG2b3b5573ab7a04bf5428a5c563846fe7`

**Billing:**
- Stripe integration for subscription management
- Plans: Starter (€90/mo), Growth (€160/mo), Enterprise (€499/mo)
- Webhooks: checkout.session.completed, subscription.updated/deleted, invoice.payment_failed
- Customer portal for self-service billing management

**Audit:**
- Actor types: user, system, ai, cron, webhook
- Logged events: appointment status changes, backfill triggers, offer lifecycle
- Stored in `audit_log` table, queryable via `/api/audit`

**Failed Jobs:**
- Failed cron/background operations stored in `failed_jobs` table
- Fields: job_type, payload, error_message, error_stack, retry_count, max_retries, next_retry_at

---

*Architecture analysis: 2026-03-09*
