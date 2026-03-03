# Architecture

**Analysis Date:** 2026-03-03

## Pattern Overview

**Overall:** Next.js 16 server-and-client hybrid with domain-driven service layer organization

**Key Characteristics:**
- Next.js App Router (directory-based routing)
- Client and server components coexisting in same feature routes
- Supabase as primary data layer (PostgreSQL + Auth)
- Service modules in `src/lib/` organized by business domain
- Feature-scoped UI components with shared `components/ui` library
- API routes with tenant-scoped data access
- Cron jobs for background processing

## Layers

**API Routes (Route Handlers):**
- Purpose: HTTP request handlers following Next.js 16 conventions
- Location: `src/app/api/`
- Contains: Endpoint definitions, request validation, response serialization
- Depends on: Supabase clients, auth helpers, lib service modules
- Used by: Frontend fetch calls, external webhooks, cron jobs

**Business Logic Services:**
- Purpose: Domain-specific operations (appointments, optimization, messaging, etc.)
- Location: `src/lib/` (subdirectories by domain: `booking/`, `optimization/`, `messaging/`, `backfill/`, `confirmation/`, `scoring/`, etc.)
- Contains: Pure functions, orchestrators, helpers
- Depends on: Supabase client, types, other lib modules
- Used by: API routes, cron jobs, frontend hooks

**Data Access Layer:**
- Purpose: Abstraction over Supabase queries
- Location: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
- Contains: Client/server Supabase client factories
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
   - Upserts or finds patient via Supabase
   - Creates appointment record with initial status `scheduled`
   - Calls `computeRiskScore()` from `src/lib/scoring/risk-score.ts`
   - Calls `generateContactSchedule()` from `src/lib/scoring/contact-timing.ts`
   - Calls `scheduleToReminders()` to create reminder records
   - Calls `createConfirmationWorkflow()` from `src/lib/confirmation/workflow.ts`
   - Returns JSON response
5. Frontend receives response, updates local state, refetches list

**Reminder Processing (Cron):**

1. Scheduled job: `src/app/api/cron/process-reminders/route.ts` (every 15 min)
2. Protected by `CRON_SECRET` env var
3. Queries `reminders` table for status `pending` and `scheduled_at <= now`
4. For each reminder:
   - Fetches full appointment + patient data
   - Selects template (`renderReminderWhatsApp` or `renderReminderSms`) from `src/lib/reminders/templates.ts`
   - Calls `sendMessage()` from `src/lib/messaging/send-message.ts`
   - Updates reminder status to `sent` or `failed`
5. Safety net: ensures appointments in next 72h have reminders scheduled
6. Returns summary (sent, failed, scheduled counts)

**Waitlist Backfill Flow:**

1. Gap fill triggered by:
   - Scheduled cron: `src/app/api/cron/run-optimization/route.ts`
   - Manual API call: `src/app/api/optimization/run/route.ts`
2. Calls orchestrator from `src/lib/optimization/calendar-optimizer.ts`
3. Orchestrator:
   - Finds cancelled/no-show appointments
   - Locates available slots via `src/lib/optimization/slot-management.ts`
   - Finds waitlist candidates via `src/lib/backfill/find-candidates.ts`
   - Scores candidates using smart scoring in `src/lib/scoring/smart-score.ts` (includes urgency, reliability, time preference, waiting time, distance, provider match, payment match)
   - Generates offers via `src/lib/backfill/send-offer.ts`
   - Creates offer records with token hash and expiry
4. Patient receives message via Twilio with `src/lib/backfill/send-offer.ts`
5. Webhook: `src/app/api/webhooks/twilio/route.ts` detects response intent
6. Offer acceptance: `src/app/api/offers/[offerId]/accept/route.ts` creates new appointment

**State Management:**

- **Session**: Supabase Auth (stored in cookies, managed by middleware)
- **Tenant**: Per-request via `getAuthenticatedTenant()` or per-hook via `useTenant()`
- **Page State**: React useState for client components (appointments list, filters, pagination)
- **Background Polling**: 30-second intervals with visibility check in `src/app/(app)/appointments/page.tsx`
- **Database State**: Source of truth for all persistent data (appointments, reminders, offers, etc.)

## Key Abstractions

**Appointment Lifecycle:**

- Defined in `src/lib/types.ts`: `AppointmentStatus` enum
- Transitions validated in `VALID_TRANSITIONS` map
- Statuses: `scheduled` → `reminder_pending` → `reminder_sent` → `confirmed`/`declined`/`timeout` → `completed`/`no_show`/`cancelled`
- Each transition triggered by API route or cron job
- Examples: `src/app/api/appointments/[id]/send-confirmation/route.ts`, `src/app/api/appointments/[id]/remind/route.ts`

**Smart Scoring System:**

- Purpose: Rank waitlist candidates for slot offers
- Location: `src/lib/scoring/smart-score.ts`
- Inputs: Urgency, reliability (past show rate), time preference match, waiting time, distance, provider match, payment match
- Output: Weighted score (0-100) + breakdown in `SmartScoreBreakdown` type
- Used by: `src/lib/backfill/find-candidates.ts`, optimization routes

**Confirmation Workflow:**

- Purpose: Guide appointment confirmation flow via messaging
- Location: `src/lib/confirmation/workflow.ts`
- States: `pending_send` → `message_sent` → `confirmed`/`declined`/`timed_out`/`cancelled`
- Triggered by: `src/app/api/appointments/route.ts` on appointment creation
- Advanced by: Twilio webhook detecting response intent

**Message Intent Detection:**

- Purpose: Parse patient responses to infer booking/offer actions
- Types in `src/lib/types.ts`: `MessageIntent` enum (confirm, cancel, accept_offer, decline_offer, slot_select, book_appointment, question, unknown)
- Sources: Regex patterns, AI classification, manual
- Used by: Webhooks, confirmation workflow, booking orchestrator
- Example: `CANCEL_PATTERN` in `src/lib/booking/booking-orchestrator.ts`

**Booking Session:**

- Purpose: Stateful conversational booking via WhatsApp/SMS
- Location: `src/lib/booking/` modules
- States: `awaiting_name` → `awaiting_date` → `awaiting_time` → `awaiting_confirmation` → `completed`/`abandoned`/`expired`
- Orchestrated by: `src/lib/booking/booking-orchestrator.ts`
- Triggered by: Twilio webhook when booking intent detected
- Expires after 30 min or abandoned

## Entry Points

**Web App Root:**
- Location: `src/app/layout.tsx`
- Triggers: Browser requests to `/`
- Responsibilities: SEO metadata, font loading, global styles, layout wrapper

**App Layout:**
- Location: `src/app/(app)/layout.tsx`
- Triggers: Authenticated requests to `/dashboard`, `/appointments`, etc.
- Responsibilities: Tenant check, sidebar navigation, auth enforcement, onboarding redirect

**API Handler:**
- Location: `src/app/api/[feature]/route.ts`
- Triggers: HTTP requests to `/api/` endpoints
- Responsibilities: Auth, request validation, business logic invocation, response formatting

**Webhook Receiver:**
- Location: `src/app/api/webhooks/twilio/route.ts`
- Triggers: Incoming SMS/WhatsApp from Twilio
- Responsibilities: Parse message, detect intent, dispatch to booking/confirmation/offer handlers

**Cron Job:**
- Location: `src/app/api/cron/[job]/route.ts`
- Triggers: Scheduled requests from Vercel Cron or external scheduler
- Responsibilities: Background processing (reminders, optimization, cleanup)

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every request before route handler
- Responsibilities: Auth session refresh, cookie management

## Error Handling

**Strategy:** Try-catch at route handler level with structured JSON responses

**Patterns:**

- **Request Validation Errors:** Return 400 with `{ success: false, error: { code: "VALIDATION_ERROR", message: "..." } }`
- **Auth Errors:** Return 401 with `{ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }`
- **Not Found:** Return 404 with `{ success: false, error: { code: "NOT_FOUND", message: "..." } }`
- **Server Errors:** Return 500 with `{ success: false, error: { code: "INTERNAL_ERROR", message: "..." } }` after logging
- **Database Errors:** Logged to console, returned as 500 with generic message
- **Webhook Failures:** Logged but gracefully handled (no crash)

Examples:
- `src/app/api/appointments/route.ts` lines 20-26: validation error handling
- `src/app/api/appointments/route.ts` lines 44-49: database error handling
- `src/app/api/cron/process-reminders/route.ts` lines 18-24: auth secret validation

## Cross-Cutting Concerns

**Logging:**
- Tool: `console.error()` for errors, `console.log()` for debug
- Patterns: Log errors with context at API routes and service functions
- Examples: `src/app/api/appointments/route.ts` line 45, `src/lib/booking/booking-orchestrator.ts` line 76

**Validation:**
- Tool: Zod schema validation
- Patterns: Define schema in `src/lib/validations.ts`, parse with `.safeParse()`, return 400 on failure
- Examples: `src/lib/validations.ts` defines 20+ schemas, used in every API route

**Authentication:**
- Tool: Supabase Auth (OAuth + session cookies)
- Patterns: `getAuthenticatedTenant()` for API routes, `useTenant()` for client components
- Enforced by: Middleware (`src/middleware.ts`), route guards in pages

**Tenancy:**
- Pattern: Scope all queries by `tenant_id`
- Enforced by: `getAuthenticatedTenant()` returns tenant ID, included in every Supabase query
- Examples: `src/app/api/appointments/route.ts` line 34

**Immutability:**
- Pattern: All types in `src/lib/types.ts` use `readonly` on fields
- Applied to: Database row types, API responses, type parameters
- Enforced by: TypeScript strict mode

**Type Safety:**
- Tool: TypeScript 5 with strict mode
- Patterns: Explicit types on all data structures, Zod for runtime validation
- Examples: `src/lib/types.ts` defines 30+ interfaces

---

*Architecture analysis: 2026-03-03*
