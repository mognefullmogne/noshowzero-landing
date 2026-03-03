# Codebase Structure

**Analysis Date:** 2026-03-03

## Directory Layout

```
noshowzero-landing/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (global styles, metadata, fonts)
│   │   ├── (app)/                    # Authenticated route group
│   │   │   ├── layout.tsx            # App layout (sidebar, tenant check)
│   │   │   ├── dashboard/            # Dashboard page
│   │   │   ├── appointments/         # Appointments management
│   │   │   ├── calendar/             # Calendar view
│   │   │   ├── waitlist/             # Waitlist management
│   │   │   ├── offers/               # Offer tracking
│   │   │   ├── messages/             # Message thread viewer
│   │   │   ├── ai-chat/              # AI chat interface
│   │   │   ├── integrations/         # Calendar integrations
│   │   │   ├── optimization/         # Optimization decisions
│   │   │   ├── rules/                # Business rules editor
│   │   │   ├── audit/                # Activity audit log
│   │   │   ├── analytics/            # Analytics dashboard
│   │   │   ├── billing/              # Stripe billing
│   │   │   ├── settings/             # Account settings
│   │   │   ├── onboarding/           # Setup wizard
│   │   │   └── docs/                 # API documentation
│   │   ├── (auth)/                   # Authentication route group
│   │   │   ├── login/                # Login page
│   │   │   ├── signup/               # Signup page
│   │   │   └── forgot-password/      # Password reset
│   │   ├── api/                      # API route handlers
│   │   │   ├── v1/                   # Public API v1
│   │   │   │   ├── appointments/     # Public: create appointments
│   │   │   │   ├── patients/         # Public: upsert patients
│   │   │   │   └── analytics/        # Public: fetch analytics
│   │   │   ├── appointments/         # Appointments CRUD + actions
│   │   │   │   ├── [id]/             # GET/PATCH single appointment
│   │   │   │   ├── [id]/remind/      # POST send manual reminder
│   │   │   │   ├── [id]/score/       # GET risk score details
│   │   │   │   └── [id]/send-confirmation/ # POST start confirmation flow
│   │   │   ├── patients/             # Patients CRUD
│   │   │   ├── waitlist/             # Waitlist CRUD
│   │   │   ├── offers/               # Offer management
│   │   │   │   ├── [offerId]/        # GET/PATCH single offer
│   │   │   │   ├── [offerId]/accept/ # POST accept offer
│   │   │   │   └── [offerId]/decline/ # POST decline offer
│   │   │   ├── messages/             # Message threads
│   │   │   ├── chat/                 # Multi-turn chat
│   │   │   ├── ai/                   # AI endpoints
│   │   │   │   ├── chat/             # General AI chat
│   │   │   │   └── appointment-chat/ # Appointment-scoped chat
│   │   │   ├── integrations/         # Calendar sync
│   │   │   │   ├── google/           # Google Calendar auth/sync
│   │   │   │   ├── outlook/          # Outlook Calendar auth/sync
│   │   │   │   └── csv/              # CSV import
│   │   │   ├── slots/                # Appointment slot management
│   │   │   │   ├── generate/         # POST generate slots
│   │   │   │   └── [id]/             # GET/PATCH single slot
│   │   │   ├── optimization/         # Optimization engine
│   │   │   │   ├── run/              # POST trigger optimization
│   │   │   │   ├── decisions/        # GET decisions
│   │   │   │   └── decisions/[id]/   # PATCH approve/reject
│   │   │   ├── rules/                # Business rules
│   │   │   │   ├── [id]/             # GET/PATCH ruleset
│   │   │   │   ├── [id]/versions/    # GET versions history
│   │   │   │   └── seed/             # POST seed default rules
│   │   │   ├── cron/                 # Background jobs
│   │   │   │   ├── process-reminders/        # Send due reminders
│   │   │   │   ├── run-optimization/        # Backfill algorithm
│   │   │   │   ├── send-confirmations/      # Send confirmation messages
│   │   │   │   ├── expire-offers/           # Expire old offers
│   │   │   │   ├── check-timeouts/          # Timeout confirmations
│   │   │   │   ├── cleanup-proposals/       # Expire old proposals
│   │   │   │   ├── sync-calendars/          # Sync integrations
│   │   │   │   └── kpi-snapshot/            # Record metrics
│   │   │   ├── webhooks/             # Webhook handlers
│   │   │   │   └── twilio/           # Incoming SMS/WhatsApp
│   │   │   ├── stripe/               # Payment webhooks
│   │   │   ├── dashboard/            # Dashboard data
│   │   │   ├── audit/                # Audit log queries
│   │   │   ├── kpi/                  # KPI snapshots
│   │   │   ├── analytics/            # Analytics queries
│   │   │   └── keys/                 # API key management
│   │   ├── callback/                 # OAuth callback
│   │   └── pricing/                  # Pricing page
│   │
│   ├── components/                   # UI components
│   │   ├── ui/                       # shadcn primitives
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── table.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── select.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ... (20+ primitives)
│   │   ├── layout/                   # Layout components
│   │   │   ├── sidebar.tsx           # App sidebar
│   │   │   └── header.tsx            # Page header
│   │   ├── appointments/             # Appointment feature
│   │   │   ├── appointments-table.tsx # List view
│   │   │   ├── appointment-dialog.tsx # Create/edit dialog
│   │   │   └── appointment-details.tsx # Detail card
│   │   ├── waitlist/                 # Waitlist feature
│   │   │   ├── waitlist-table.tsx    # List view
│   │   │   ├── waitlist-dialog.tsx   # Create/edit dialog
│   │   │   ├── urgency-badge.tsx     # Clinical urgency indicator
│   │   │   └── score-breakdown.tsx   # Smart score display
│   │   ├── offers/                   # Offer tracking
│   │   │   ├── offers-table.tsx
│   │   │   └── offer-card.tsx
│   │   ├── dashboard/                # Dashboard components
│   │   │   ├── kpi-cards.tsx         # Summary metrics
│   │   │   ├── today-section.tsx     # Today's appointments
│   │   │   └── urgent-deadlines.tsx  # Urgent items
│   │   ├── analytics/                # Analytics charts
│   │   │   └── metrics-chart.tsx
│   │   ├── chat/                     # Chat/messaging
│   │   │   ├── chat-widget.tsx       # Floating chat button
│   │   │   ├── chat-panel.tsx        # Chat panel
│   │   │   └── message-item.tsx      # Message display
│   │   ├── auth/                     # Auth components
│   │   │   ├── login-form.tsx
│   │   │   ├── signup-form.tsx
│   │   │   └── oauth-buttons.tsx
│   │   ├── billing/                  # Billing components
│   │   │   ├── plan-selector.tsx
│   │   │   └── usage-meter.tsx
│   │   ├── landing/                  # Landing page
│   │   │   ├── hero.tsx
│   │   │   ├── features.tsx
│   │   │   └── cta.tsx
│   │   └── shared/                   # Shared components
│   │       ├── loading-spinner.tsx
│   │       ├── error-boundary.tsx
│   │       └── empty-state.tsx
│   │
│   ├── lib/                          # Business logic
│   │   ├── supabase/                 # Data access
│   │   │   ├── client.ts             # Browser client factory
│   │   │   ├── server.ts             # Server client factory + service role
│   │   │   └── middleware.ts         # Session refresh logic
│   │   ├── types.ts                  # Core type definitions
│   │   ├── validations.ts            # Zod validation schemas (25+ schemas)
│   │   ├── utils.ts                  # Utility functions
│   │   ├── auth-helpers.ts           # getAuthenticatedTenant()
│   │   ├── api-key-auth.ts           # API key validation
│   │   │
│   │   ├── scoring/                  # Scoring algorithms
│   │   │   ├── risk-score.ts         # Appointment risk assessment
│   │   │   ├── smart-score.ts        # Waitlist candidate ranking
│   │   │   ├── contact-timing.ts     # Reminder scheduling logic
│   │   │   └── reliability.ts        # Patient reliability metrics
│   │   │
│   │   ├── booking/                  # Conversational booking
│   │   │   ├── booking-orchestrator.ts # Main state machine
│   │   │   ├── session-manager.ts    # Session CRUD + state
│   │   │   ├── slot-finder.ts        # Available slot queries
│   │   │   ├── date-parser.ts        # Natural language date parsing
│   │   │   ├── appointment-creator.ts # Appointment record creation
│   │   │   ├── tenant-resolver.ts    # Tenant lookup
│   │   │   ├── types.ts              # Session types
│   │   │   └── messages.ts           # Bot reply templates
│   │   │
│   │   ├── backfill/                 # Waitlist offer engine
│   │   │   ├── find-candidates.ts    # Smart ranking
│   │   │   ├── send-offer.ts         # Create offer + send message
│   │   │   ├── offer-tokens.ts       # One-time token generation
│   │   │   ├── process-response.ts   # Handle patient response
│   │   │   ├── expire-offers.ts      # Cleanup job
│   │   │   └── trigger-backfill.ts   # Main orchestrator
│   │   │
│   │   ├── confirmation/             # Confirmation workflow
│   │   │   ├── workflow.ts           # State machine
│   │   │   └── templates.ts          # Message templates
│   │   │
│   │   ├── reminders/                # Reminder processing
│   │   │   ├── schedule-reminders.ts # Create reminder records
│   │   │   └── templates.ts          # WhatsApp/SMS templates
│   │   │
│   │   ├── messaging/                # Message delivery
│   │   │   ├── send-message.ts       # Twilio dispatcher
│   │   │   ├── twilio-client.ts      # Twilio SDK wrapper
│   │   │   └── intent-detector.ts    # Parse patient intent
│   │   │
│   │   ├── optimization/             # Slot optimization
│   │   │   ├── calendar-optimizer.ts # Main orchestrator
│   │   │   ├── proactive-reschedule.ts # Offer alternative times
│   │   │   └── slot-management.ts    # Slot queries + state
│   │   │
│   │   ├── integrations/             # Calendar sync
│   │   │   ├── sync-engine.ts        # Orchestrator
│   │   │   ├── google-calendar.ts    # Google API wrapper
│   │   │   ├── outlook-calendar.ts   # Outlook API wrapper
│   │   │   ├── csv-parser.ts         # CSV import
│   │   │   ├── ical-parser.ts        # iCalendar parsing
│   │   │   ├── appointment-importer.ts # Record creation
│   │   │   ├── token-refresh.ts      # OAuth token refresh
│   │   │   ├── encryption.ts         # Token encryption
│   │   │   ├── oauth-state.ts        # CSRF protection
│   │   │   ├── validate-ical-url.ts  # iCal URL validation
│   │   │   └── types.ts              # Integration types
│   │   │
│   │   ├── proposals/                # Slot proposals
│   │   │   └── slot-proposal.ts      # Proposal logic
│   │   │
│   │   ├── rules/                    # Business rules engine
│   │   │   └── rule-evaluator.ts     # Condition evaluation
│   │   │
│   │   ├── audit/                    # Activity logging
│   │   │   └── log-event.ts          # Record audit event
│   │   │
│   │   ├── kpi/                      # Metrics & analytics
│   │   │   └── snapshot.ts           # Record KPI snapshot
│   │   │
│   │   ├── twilio/                   # Twilio utilities
│   │   │   └── webhook-validator.ts  # Request signature validation
│   │   │
│   │   ├── webhooks/                 # Generic webhook handlers
│   │   │   └── processor.ts          # Webhook event routing
│   │   │
│   │   ├── stripe.ts                 # Stripe client
│   │   └── ai.ts                     # Claude SDK client
│   │
│   ├── hooks/                        # React hooks
│   │   └── use-tenant.ts             # Fetch tenant data
│   │
│   └── middleware.ts                 # Request middleware
│
├── public/                           # Static assets
│   ├── favicon.ico
│   └── ...
├── supabase/                         # Supabase migrations
│   ├── migrations/
│   │   ├── 20250101000000_init.sql   # Initial schema
│   │   ├── 20250115000000_add_smart_scoring.sql
│   │   └── ... (20+ migrations)
│   └── .temp/                        # Supabase CLI temp files
├── scripts/                          # Utility scripts
├── .planning/                        # GSD planning docs
│   └── codebase/                     # This directory
│
├── next.config.ts                    # Next.js config
├── tsconfig.json                     # TypeScript config
├── package.json                      # Dependencies
├── .eslintrc.mjs                     # ESLint config
├── postcss.config.mjs                # Tailwind PostCSS
├── components.json                   # shadcn config
├── tailwind.config.ts                # Tailwind config
├── .env.local                        # Local env (git ignored)
├── .env.example                      # Env var template
└── vercel.json                       # Vercel deployment config
```

## Directory Purposes

**src/app/**
- Purpose: Next.js App Router pages and API routes
- Contains: Route groups, page components, API handlers, webhooks
- Key files: `layout.tsx`, `middleware.ts`

**src/components/**
- Purpose: Reusable React components
- Contains: shadcn primitives, feature-scoped components
- Pattern: Components use PascalCase filenames, export default component

**src/lib/**
- Purpose: Business logic, data access, utilities
- Contains: Domain-organized modules (booking/, optimization/, etc.)
- Pattern: Each module exports pure functions and orchestrators
- Key files: `types.ts` (core types), `validations.ts` (Zod schemas)

**src/lib/supabase/**
- Purpose: Supabase client factories and middleware
- Contains: Client creation, session management
- Key files: `client.ts` (browser), `server.ts` (server + service role)

**src/lib/[domain]/**
- Purpose: Domain-specific business logic
- Domains: `booking/` (conversational flow), `backfill/` (offers), `optimization/` (slot management), `scoring/` (risk/smart scores), `reminders/`, `messaging/`, `confirmation/`, `integrations/`, `rules/`, `audit/`, `kpi/`

**supabase/migrations/**
- Purpose: Database schema versioning
- Contains: SQL migration files with timestamps
- Pattern: Migrations applied sequentially, immutable once committed

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout, SEO, fonts, globals
- `src/app/(app)/layout.tsx`: App layout, sidebar, tenant check, auth enforcement
- `src/middleware.ts`: Request middleware for auth session refresh

**Configuration:**
- `next.config.ts`: Next.js config (security headers)
- `tsconfig.json`: TypeScript compiler options
- `.eslintrc.mjs`: ESLint rules
- `tailwind.config.ts`: Tailwind theme
- `components.json`: shadcn CLI config
- `.env.local`: Secrets (not committed)

**Core Logic:**
- `src/lib/types.ts`: 30+ interfaces defining appointments, patients, offers, etc.
- `src/lib/validations.ts`: 25+ Zod schemas for request validation
- `src/lib/auth-helpers.ts`: `getAuthenticatedTenant()` for API auth
- `src/lib/scoring/smart-score.ts`: Waitlist ranking algorithm

**Testing:**
- No test files in current codebase (test directory does not exist)

## Naming Conventions

**Files:**
- React components: PascalCase (e.g., `AppointmentDialog.tsx`)
- Utilities/modules: kebab-case (e.g., `slot-finder.ts`)
- API routes: lowercase with brackets for dynamic segments (e.g., `[id]/route.ts`)
- Types/constants: PascalCase for types, UPPER_SNAKE_CASE for constants

**Directories:**
- Feature directories: lowercase, plural (e.g., `appointments/`, `components/`)
- Domain modules in lib: lowercase (e.g., `booking/`, `optimization/`)
- Route groups: parentheses prefix (e.g., `(app)/`, `(auth)/`)

**Functions:**
- Handlers: `handle*` prefix (e.g., `handleBookingMessage()`)
- Getters: `get*` or `fetch*` prefix (e.g., `getAuthenticatedTenant()`, `fetchAppointments()`)
- Checkers: `is*` or `check*` prefix (e.g., `isOnboarding`, `checkExpiry()`)
- Creators: `create*` prefix (e.g., `createAppointment()`, `createSession()`)

**Variables:**
- Boolean: `is*`, `has*`, `should*` (e.g., `isLoading`, `hasError`)
- String/number: descriptive lowercase (e.g., `tenantId`, `statusFilter`)
- Constants: UPPER_SNAKE_CASE (e.g., `CANCEL_PATTERN`, `MAX_ATTEMPTS`)

**Types:**
- Data types: PascalCase (e.g., `Appointment`, `WaitlistEntry`)
- Status enums: lowercase with pipes (e.g., `type AppointmentStatus = "scheduled" | "confirmed"`)
- Response enums: PascalCase (e.g., `type MessageIntent = "confirm" | "cancel"`)

## Where to Add New Code

**New Feature Page:**
1. Create directory: `src/app/(app)/[feature-name]/`
2. Add page: `src/app/(app)/[feature-name]/page.tsx` (use `"use client"` for interactivity)
3. API route(s): `src/app/api/[feature-name]/route.ts`
4. Components: `src/components/[feature-name]/[component-name].tsx`
5. Business logic: `src/lib/[feature-name]/[module-name].ts`
6. Validation schema: Add to `src/lib/validations.ts`
7. Type definitions: Add to `src/lib/types.ts` if needed

**New API Endpoint:**
1. Create route file: `src/app/api/[endpoint]/route.ts`
2. Add validation schema to: `src/lib/validations.ts`
3. Add business logic: `src/lib/[domain]/[module].ts`
4. Use auth helper: `getAuthenticatedTenant()` from `src/lib/auth-helpers.ts`
5. Scope queries by `tenant_id`

**New Component:**
1. If shareable: `src/components/shared/[component-name].tsx`
2. If feature-scoped: `src/components/[feature]/[component-name].tsx`
3. If UI primitive: `src/components/ui/[primitive].tsx` (use shadcn)
4. Use PascalCase filename, export default
5. Separate `"use client"` and Server Components intentionally

**New Business Logic Module:**
1. Create directory: `src/lib/[domain]/`
2. Create module: `src/lib/[domain]/[module-name].ts`
3. Export pure functions and orchestrators
4. Use Supabase client: `createClient()` or `createServiceClient()`
5. Scope queries by `tenant_id`

**Database Migration:**
1. Create file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Timestamp must be unique and sequential
3. SQL is immutable once committed
4. Run locally: `supabase db push`

## Special Directories

**src/app/api/v1/**
- Purpose: Public API endpoints (with API key auth)
- Generated: No
- Committed: Yes
- Pattern: External integrations can call these endpoints

**src/app/api/cron/**
- Purpose: Background jobs triggered by Vercel Cron or scheduler
- Generated: No
- Committed: Yes
- Pattern: Protected by `CRON_SECRET` env var
- Jobs: process-reminders (15 min), run-optimization (hourly), expire-offers, sync-calendars

**src/app/api/webhooks/**
- Purpose: Inbound webhooks (Twilio, Stripe, etc.)
- Generated: No
- Committed: Yes
- Pattern: Use signature validation (e.g., Twilio request verification)

**src/components/ui/**
- Purpose: shadcn primitives
- Generated: Mostly (via `npx shadcn add`)
- Committed: Yes
- Pattern: Use Radix UI + Tailwind

**supabase/migrations/**
- Purpose: Database schema versioning
- Generated: No (hand-written SQL)
- Committed: Yes
- Pattern: Immutable once applied

**supabase/.temp/**
- Purpose: Temporary CLI files
- Generated: Yes (by Supabase CLI)
- Committed: No

**.next/**
- Purpose: Next.js build output
- Generated: Yes (by `next build`)
- Committed: No

---

*Structure analysis: 2026-03-03*
