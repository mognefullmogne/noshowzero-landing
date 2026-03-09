# Codebase Structure

**Analysis Date:** 2026-03-09

## Directory Layout

```
noshowzero-landing/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (global styles, metadata, fonts)
│   │   ├── page.tsx                  # Landing page
│   │   ├── (app)/                    # Authenticated route group
│   │   │   ├── layout.tsx            # App layout (sidebar, tenant check)
│   │   │   ├── dashboard/            # Dashboard page
│   │   │   ├── appointments/         # Appointments management
│   │   │   ├── calendar/             # Calendar view
│   │   │   ├── waitlist/             # Waitlist management
│   │   │   ├── offers/               # Offer tracking
│   │   │   ├── messages/             # Message thread viewer
│   │   │   ├── ai-chat/              # AI chat interface
│   │   │   ├── strategy-log/         # AI strategy log viewer
│   │   │   ├── integrations/         # Calendar integrations
│   │   │   ├── optimization/         # Optimization decisions
│   │   │   ├── organizzazione/       # Organization management (operators, services)
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
│   │   │   │   ├── appointments/     # Public: create/get appointments
│   │   │   │   │   └── [externalId]/ # GET by external ID
│   │   │   │   ├── patients/         # Public: upsert patients
│   │   │   │   └── analytics/
│   │   │   │       └── summary/      # Public: fetch analytics summary
│   │   │   ├── appointments/         # Appointments CRUD + actions
│   │   │   │   ├── [id]/             # GET/PATCH single appointment
│   │   │   │   ├── [id]/remind/      # POST send manual reminder
│   │   │   │   ├── [id]/score/       # GET risk score details
│   │   │   │   └── [id]/send-confirmation/ # POST start confirmation flow
│   │   │   ├── patients/             # Patients CRUD
│   │   │   │   └── [id]/             # GET/PATCH single patient
│   │   │   ├── operators/            # Operators CRUD
│   │   │   │   └── [id]/             # GET/PATCH/DELETE operator
│   │   │   │       └── services/     # GET/PUT operator-service assignments
│   │   │   ├── services/             # Services CRUD
│   │   │   │   └── [id]/             # GET/PATCH/DELETE service
│   │   │   ├── waitlist/             # Waitlist CRUD
│   │   │   │   └── [id]/             # GET/PATCH single entry
│   │   │   ├── offers/               # Offer management
│   │   │   │   └── [offerId]/        # GET/PATCH single offer
│   │   │   │       ├── accept/       # POST accept offer
│   │   │   │       └── decline/      # POST decline offer
│   │   │   ├── messages/             # Message threads
│   │   │   │   └── [threadId]/       # GET thread messages
│   │   │   ├── chat/                 # Multi-turn chat
│   │   │   ├── ai/                   # AI endpoints
│   │   │   │   ├── chat/             # General AI chat (operator-facing)
│   │   │   │   ├── appointment-chat/ # Appointment-scoped AI chat
│   │   │   │   ├── morning-briefing/ # GET daily AI briefing
│   │   │   │   ├── strategy-log/     # GET/POST AI decision log
│   │   │   │   └── no-show-analysis/ # POST AI no-show pattern analysis
│   │   │   ├── intelligence/         # Intelligence layer
│   │   │   │   └── overbooking/      # POST overbooking recommendations
│   │   │   ├── integrations/         # Calendar sync
│   │   │   │   ├── [id]/             # GET/DELETE integration
│   │   │   │   │   └── sync/         # POST trigger sync
│   │   │   │   ├── google/           # Google Calendar
│   │   │   │   │   ├── auth/         # GET start OAuth flow
│   │   │   │   │   ├── callback/     # GET OAuth callback
│   │   │   │   │   └── calendars/    # GET list calendars
│   │   │   │   ├── outlook/          # Outlook Calendar
│   │   │   │   │   ├── auth/         # GET start OAuth flow
│   │   │   │   │   ├── callback/     # GET OAuth callback
│   │   │   │   │   └── calendars/    # GET list calendars
│   │   │   │   └── csv/
│   │   │   │       └── upload/       # POST CSV import
│   │   │   ├── slots/                # Appointment slot management
│   │   │   │   ├── generate/         # POST generate slots
│   │   │   │   └── [id]/             # GET/PATCH single slot
│   │   │   ├── optimization/         # Optimization engine
│   │   │   │   ├── run/              # POST trigger optimization
│   │   │   │   └── decisions/        # GET decisions
│   │   │   │       └── [id]/         # PATCH approve/reject
│   │   │   ├── rules/                # Business rules
│   │   │   │   ├── [id]/             # GET/PATCH ruleset
│   │   │   │   │   └── versions/     # GET versions history
│   │   │   │   └── seed/             # POST seed default rules
│   │   │   ├── settings/             # Settings endpoints
│   │   │   │   ├── tenant/           # GET/PATCH tenant settings
│   │   │   │   └── sidebar-order/    # GET/PATCH sidebar order
│   │   │   ├── admin/                # Admin endpoints
│   │   │   │   └── trigger-backfill/ # POST manually trigger backfill
│   │   │   ├── cron/                 # Background jobs
│   │   │   │   ├── process-reminders/        # Send due reminders
│   │   │   │   ├── run-optimization/         # Backfill algorithm
│   │   │   │   ├── send-confirmations/       # Send confirmation messages
│   │   │   │   ├── expire-offers/            # Expire old offers
│   │   │   │   ├── check-timeouts/           # Timeout confirmations
│   │   │   │   ├── cleanup-proposals/        # Expire old proposals
│   │   │   │   ├── sync-calendars/           # Sync integrations
│   │   │   │   ├── kpi-snapshot/             # Record metrics
│   │   │   │   ├── detect-no-shows/          # Detect no-show appointments
│   │   │   │   └── escalate-confirmations/   # Escalate unconfirmed appointments
│   │   │   ├── webhooks/             # Webhook handlers
│   │   │   │   └── twilio/           # Incoming SMS/WhatsApp
│   │   │   ├── stripe/               # Stripe endpoints
│   │   │   │   ├── checkout/         # POST create checkout session
│   │   │   │   ├── portal/           # POST create billing portal
│   │   │   │   └── webhook/          # POST Stripe webhook handler
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
│   │   │   ├── accordion.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── sonner.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── textarea.tsx
│   │   ├── layout/                   # Layout components
│   │   │   ├── navbar.tsx            # Top navigation bar
│   │   │   └── footer.tsx            # Page footer
│   │   ├── appointments/             # Appointment feature
│   │   │   ├── appointments-table.tsx # List view
│   │   │   ├── appointment-dialog.tsx # Create/edit dialog
│   │   │   ├── appointment-detail.tsx # Detail view
│   │   │   ├── appointment-ai-chat.tsx # Per-appointment AI chat
│   │   │   ├── risk-badge.tsx        # Risk level indicator
│   │   │   └── status-badge.tsx      # Appointment status indicator
│   │   ├── waitlist/                 # Waitlist feature
│   │   │   ├── waitlist-table.tsx    # List view
│   │   │   ├── waitlist-dialog.tsx   # Create/edit dialog
│   │   │   ├── urgency-badge.tsx     # Clinical urgency indicator
│   │   │   └── score-breakdown.tsx   # Smart score display
│   │   ├── offers/                   # Offer tracking
│   │   │   ├── offers-table.tsx
│   │   │   └── offer-status-badge.tsx
│   │   ├── dashboard/                # Dashboard components
│   │   │   ├── operational-dashboard.tsx # Main dashboard layout
│   │   │   ├── morning-briefing.tsx  # AI morning briefing card
│   │   │   ├── strategy-log-section.tsx # AI strategy log
│   │   │   ├── no-show-insights.tsx  # No-show pattern insights
│   │   │   ├── active-offers-section.tsx # Active offers summary
│   │   │   └── activity-feed-section.tsx # Recent activity feed
│   │   ├── analytics/                # Analytics charts
│   │   │   └── kpi-card.tsx          # KPI metric card
│   │   ├── chat/                     # Chat/messaging
│   │   │   └── chat-widget.tsx       # Floating chat button + panel
│   │   ├── auth/                     # Auth components
│   │   │   └── google-button.tsx     # Google OAuth button
│   │   ├── landing/                  # Landing page sections
│   │   │   ├── hero.tsx              # Hero section
│   │   │   ├── features-grid.tsx     # Features grid
│   │   │   ├── how-it-works.tsx      # How it works steps
│   │   │   ├── problem-stats.tsx     # Problem statistics
│   │   │   ├── industries.tsx        # Target industries
│   │   │   ├── testimonials.tsx      # Customer testimonials
│   │   │   ├── social-proof.tsx      # Social proof section
│   │   │   ├── faq.tsx               # FAQ section
│   │   │   ├── pricing-section.tsx   # Pricing plans
│   │   │   └── final-cta.tsx         # Final call-to-action
│   │   ├── shared/                   # Shared components
│   │   │   ├── animated-counter.tsx  # Animated number counter
│   │   │   ├── connection-status.tsx # Realtime connection indicator
│   │   │   ├── empty-state.tsx       # Empty state placeholder
│   │   │   ├── loading-spinner.tsx   # Loading spinner
│   │   │   ├── page-header.tsx       # Page header with title
│   │   │   ├── pagination.tsx        # Pagination controls
│   │   │   ├── scroll-reveal.tsx     # Scroll-triggered reveal
│   │   │   ├── section-wrapper.tsx   # Section layout wrapper
│   │   │   └── status-badge.tsx      # Generic status badge
│   │   └── sortable-sidebar.tsx      # Drag-sortable sidebar
│   │
│   ├── lib/                          # Business logic
│   │   ├── types.ts                  # Core type definitions
│   │   ├── validations.ts            # Zod validation schemas (25+ schemas)
│   │   ├── utils.ts                  # Utility functions
│   │   ├── constants.ts              # App-wide constants
│   │   ├── auth-helpers.ts           # getAuthenticatedTenant()
│   │   ├── api-key-auth.ts           # API key validation
│   │   ├── cron-auth.ts              # Cron job authentication
│   │   ├── sidebar-links.ts          # Sidebar navigation config
│   │   ├── stripe.ts                 # Stripe client
│   │   │
│   │   ├── supabase/                 # Data access
│   │   │   ├── client.ts             # Browser client factory
│   │   │   ├── server.ts             # Server client factory + service role
│   │   │   └── middleware.ts          # Session refresh logic
│   │   │
│   │   ├── ai/                       # AI/Claude integration
│   │   │   ├── operator-chat.ts      # Operator-facing AI chat logic
│   │   │   ├── appointment-chat.ts   # Appointment-scoped AI chat
│   │   │   ├── decision-engine.ts    # AI-driven decision making
│   │   │   ├── morning-briefing.ts   # Daily AI briefing generation
│   │   │   ├── no-show-analysis.ts   # No-show pattern analysis
│   │   │   ├── patient-memory.ts     # AI patient context/history
│   │   │   ├── smart-rebook.ts       # AI-assisted rebooking
│   │   │   ├── tool-registry.ts      # AI tool definitions registry
│   │   │   ├── tools/                # Individual AI tools
│   │   │   │   ├── get-calendar-overview.ts
│   │   │   │   ├── send-message-to-patient.ts
│   │   │   │   ├── find-available-slots.ts
│   │   │   │   ├── get-patient-info.ts
│   │   │   │   ├── get-appointment-details.ts
│   │   │   │   ├── search-appointments.ts
│   │   │   │   ├── add-to-waitlist.ts
│   │   │   │   ├── reschedule-appointment.ts
│   │   │   │   ├── check-waitlist.ts
│   │   │   │   └── cancel-appointment.ts
│   │   │   └── __tests__/            # AI module tests
│   │   │       ├── decision-engine.test.ts
│   │   │       ├── morning-briefing.test.ts
│   │   │       ├── no-show-analysis.test.ts
│   │   │       ├── patient-memory.test.ts
│   │   │       └── smart-rebook.test.ts
│   │   │
│   │   ├── intelligence/             # Intelligence layer
│   │   │   ├── index.ts              # Module exports
│   │   │   ├── overbooking.ts        # Overbooking recommendations
│   │   │   ├── no-show-detector.ts   # No-show detection logic
│   │   │   ├── slot-recommendations.ts # Smart slot suggestions
│   │   │   └── response-patterns.ts  # Patient response pattern analysis
│   │   │
│   │   ├── scoring/                  # Scoring algorithms
│   │   │   ├── risk-score.ts         # Appointment risk assessment
│   │   │   ├── ai-risk-score.ts      # AI-enhanced risk scoring
│   │   │   ├── waitlist-score.ts     # Waitlist entry scoring
│   │   │   ├── candidate-score.ts    # Backfill candidate ranking
│   │   │   ├── ai-candidate-ranker.ts # AI-enhanced candidate ranking
│   │   │   ├── contact-timing.ts     # Reminder scheduling logic
│   │   │   ├── auto-score.ts         # Automatic scoring triggers
│   │   │   ├── ai-confirmation-personalizer.ts # AI-personalized confirmations
│   │   │   └── __tests__/            # Scoring tests
│   │   │       ├── ai-candidate-ranker.test.ts
│   │   │       ├── ai-confirmation-personalizer.test.ts
│   │   │       └── candidate-score.test.ts
│   │   │
│   │   ├── booking/                  # Conversational booking
│   │   │   ├── booking-orchestrator.ts # Main state machine
│   │   │   ├── session-manager.ts    # Session CRUD + state
│   │   │   ├── slot-finder.ts        # Available slot queries
│   │   │   ├── date-parser.ts        # Natural language date parsing
│   │   │   ├── appointment-creator.ts # Appointment record creation
│   │   │   ├── tenant-resolver.ts    # Tenant lookup
│   │   │   ├── provider-conflict.ts  # Provider scheduling conflicts
│   │   │   ├── types.ts              # Session types
│   │   │   └── messages.ts           # Bot reply templates
│   │   │
│   │   ├── backfill/                 # Waitlist offer engine
│   │   │   ├── trigger-backfill.ts   # Main orchestrator
│   │   │   ├── find-candidates.ts    # Smart ranking
│   │   │   ├── find-available-slots.ts # Slot availability check
│   │   │   ├── send-offer.ts         # Create offer + send message
│   │   │   ├── offer-tokens.ts       # One-time token generation
│   │   │   ├── process-response.ts   # Handle patient response
│   │   │   ├── expire-offers.ts      # Cleanup job
│   │   │   ├── check-expired-offers.ts # Expired offer check
│   │   │   ├── preemptive-cascade.ts # Cascading backfill logic
│   │   │   ├── time-aware-config.ts  # Time-sensitive configuration
│   │   │   └── __tests__/            # Backfill tests
│   │   │       ├── find-candidates.test.ts
│   │   │       ├── process-response.test.ts
│   │   │       ├── trigger-backfill.test.ts
│   │   │       └── helpers.ts
│   │   │
│   │   ├── confirmation/             # Confirmation workflow
│   │   │   ├── workflow.ts           # State machine
│   │   │   ├── templates.ts          # Message templates
│   │   │   ├── escalation.ts         # Escalation logic for unconfirmed
│   │   │   └── timing.ts            # Confirmation timing rules
│   │   │
│   │   ├── reminders/                # Reminder processing
│   │   │   ├── schedule-reminders.ts # Create reminder records
│   │   │   └── templates.ts          # WhatsApp/SMS templates
│   │   │
│   │   ├── messaging/                # Message delivery
│   │   │   ├── send-message.ts       # Twilio dispatcher
│   │   │   ├── intent-engine.ts      # Parse patient intent (AI-powered)
│   │   │   └── patient-bot.ts        # Patient-facing bot logic
│   │   │
│   │   ├── twilio/                   # Twilio utilities
│   │   │   ├── client.ts             # Twilio SDK wrapper
│   │   │   ├── templates.ts          # Twilio message templates
│   │   │   ├── content-templates.ts  # WhatsApp Content Templates
│   │   │   └── send-notification.ts  # Notification dispatcher
│   │   │
│   │   ├── webhooks/                 # Webhook handlers
│   │   │   ├── twilio-verify.ts      # Request signature validation
│   │   │   └── message-router.ts     # Inbound message routing
│   │   │
│   │   ├── optimization/             # Slot optimization
│   │   │   ├── calendar-optimizer.ts # Main orchestrator
│   │   │   ├── proactive-reschedule.ts # Offer alternative times
│   │   │   └── slot-management.ts    # Slot queries + state
│   │   │
│   │   ├── integrations/             # Calendar sync
│   │   │   ├── google-calendar.ts    # Google API wrapper
│   │   │   ├── outlook-calendar.ts   # Outlook API wrapper
│   │   │   ├── appointment-importer.ts # Record creation from sync
│   │   │   ├── csv-parser.ts         # CSV import
│   │   │   ├── ical-parser.ts        # iCalendar parsing
│   │   │   ├── token-refresh.ts      # OAuth token refresh
│   │   │   ├── encryption.ts         # Token encryption
│   │   │   ├── oauth-state.ts        # CSRF protection
│   │   │   ├── validate-ical-url.ts  # iCal URL validation
│   │   │   └── types.ts              # Integration types
│   │   │
│   │   ├── proposals/                # Slot proposals
│   │   │   ├── create-proposal.ts    # Proposal creation
│   │   │   └── find-slots.ts         # Slot search for proposals
│   │   │
│   │   ├── engine/                   # Processing engine
│   │   │   └── process-pending.ts    # Process pending items
│   │   │
│   │   ├── rules/                    # Business rules engine
│   │   │   └── rule-engine.ts        # Condition evaluation
│   │   │
│   │   ├── audit/                    # Activity logging
│   │   │   └── log-event.ts          # Record audit event
│   │   │
│   │   ├── kpi/                      # Metrics & analytics
│   │   │   └── compute-snapshot.ts   # Compute KPI snapshot
│   │   │
│   │   ├── metrics/                  # Recovery metrics
│   │   │   ├── recovery-metrics.ts   # Revenue recovery tracking
│   │   │   └── recovery-metrics.test.ts
│   │   │
│   │   ├── strategy-log/             # Strategy logging
│   │   │   └── types.ts              # Strategy log types
│   │   │
│   │   └── realtime/                 # Realtime updates
│   │       ├── types.ts              # Realtime event types
│   │       └── apply-delta.ts        # Apply realtime deltas
│   │
│   ├── hooks/                        # React hooks
│   │   ├── use-tenant.ts             # Fetch tenant data
│   │   └── use-realtime-appointments.ts # Realtime appointment updates
│   │
│   └── middleware.ts                 # Request middleware
│
├── public/                           # Static assets
│   ├── favicon.ico
│   └── ...
├── supabase/                         # Supabase migrations
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_product_tables.sql
│   │   ├── 003_waitlist_offers.sql
│   │   ├── 004_messaging.sql
│   │   ├── 005_appointment_slots.sql
│   │   ├── 006_optimization.sql
│   │   ├── 007_rules.sql
│   │   ├── 008_audit.sql
│   │   ├── 009_workflows.sql
│   │   ├── 010_booking_sessions.sql
│   │   ├── 011_integrations.sql
│   │   ├── 012_candidate_detection.sql
│   │   ├── 013_tenant_appointment_value.sql
│   │   ├── 014_intelligence_layer.sql
│   │   ├── 015_sidebar_order.sql
│   │   ├── 016_waitlist_offer_columns.sql
│   │   ├── 017_organization.sql
│   │   ├── 018_phone_index.sql
│   │   └── 019_cal_integrations_update_policy.sql
│   └── .temp/                        # Supabase CLI temp files
├── scripts/                          # Utility scripts
│   ├── run-migrations.mjs            # Migration runner
│   ├── verify-infrastructure.mjs     # Infrastructure verification
│   ├── seed-hairdresser.mjs          # Seed demo data
│   ├── test-backfill.ts              # Backfill testing
│   ├── debug-google-cal.ts           # Google Calendar debugging
│   ├── combined_migrations_004_009.sql # Combined migration SQL
│   └── all-migrations-sql-editor.sql # All migrations for SQL editor
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
- Contains: Domain-organized modules (ai/, booking/, optimization/, etc.)
- Pattern: Each module exports pure functions and orchestrators
- Key files: `types.ts` (core types), `validations.ts` (Zod schemas)

**src/lib/supabase/**
- Purpose: Supabase client factories and middleware
- Contains: Client creation, session management
- Key files: `client.ts` (browser), `server.ts` (server + service role)

**src/lib/ai/**
- Purpose: Claude AI integration, tool-use agents, analysis engines
- Contains: Operator chat, appointment chat, morning briefing, decision engine, no-show analysis, patient memory, smart rebook
- Key files: `tool-registry.ts` (registers all AI tools), `operator-chat.ts` (main chat logic)
- Subdirectories: `tools/` (10 individual tool implementations), `__tests__/` (5 test files)

**src/lib/intelligence/**
- Purpose: Intelligence layer for predictions and recommendations
- Contains: Overbooking engine, no-show detection, slot recommendations, response patterns
- Key files: `overbooking.ts`, `no-show-detector.ts`

**src/lib/scoring/**
- Purpose: Risk scoring, candidate ranking, confirmation personalization
- Contains: Rule-based and AI-enhanced scoring algorithms
- Key files: `risk-score.ts`, `ai-risk-score.ts`, `candidate-score.ts`, `ai-candidate-ranker.ts`

**src/lib/booking/**
- Purpose: Conversational booking via WhatsApp
- Contains: State machine, session management, slot finding, date parsing
- Key files: `booking-orchestrator.ts` (main state machine), `date-parser.ts`

**src/lib/backfill/**
- Purpose: Waitlist offer engine — fill cancelled slots
- Contains: Candidate finding, offer sending, response processing, cascading
- Key files: `trigger-backfill.ts` (orchestrator), `find-candidates.ts`

**src/lib/confirmation/**
- Purpose: Appointment confirmation workflow
- Contains: State machine, templates, escalation, timing rules
- Key files: `workflow.ts` (state machine), `escalation.ts`, `timing.ts`

**src/lib/twilio/**
- Purpose: Twilio SDK wrapper and message dispatch
- Contains: Client, templates, content templates, notification sender
- Key files: `client.ts`, `send-notification.ts`, `content-templates.ts`

**src/lib/webhooks/**
- Purpose: Inbound webhook handling and message routing
- Contains: Twilio signature verification, message routing
- Key files: `message-router.ts` (routes inbound messages), `twilio-verify.ts`

**src/lib/messaging/**
- Purpose: Message delivery and intent detection
- Contains: Twilio dispatcher, AI intent engine, patient bot
- Key files: `send-message.ts`, `intent-engine.ts`, `patient-bot.ts`

**src/lib/[other domains]/**
- Domains: `optimization/` (slot optimization), `integrations/` (calendar sync), `reminders/` (reminder processing), `proposals/` (slot proposals), `rules/` (business rules), `audit/` (activity logging), `kpi/` (metrics), `engine/` (processing), `metrics/` (recovery tracking), `strategy-log/` (AI strategy types), `realtime/` (live updates)

**supabase/migrations/**
- Purpose: Database schema versioning (19 migrations)
- Contains: SQL migration files with sequential numbering
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
- `src/lib/cron-auth.ts`: Cron job authentication
- `src/lib/ai/tool-registry.ts`: AI tool definitions for Claude tool-use
- `src/lib/intelligence/overbooking.ts`: Overbooking recommendation engine

**Testing:**
- `src/lib/ai/__tests__/`: 5 test files (decision-engine, morning-briefing, no-show-analysis, patient-memory, smart-rebook)
- `src/lib/scoring/__tests__/`: 3 test files (ai-candidate-ranker, ai-confirmation-personalizer, candidate-score)
- `src/lib/backfill/__tests__/`: 3 test files + helpers (find-candidates, process-response, trigger-backfill)
- `src/lib/metrics/recovery-metrics.test.ts`: Recovery metrics test
- `src/app/api/webhooks/twilio/__tests__/route.test.ts`: Twilio webhook test
- `src/app/api/ai/strategy-log/__tests__/route.test.ts`: Strategy log API test

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
1. Create file: `supabase/migrations/NNN_description.sql` (sequential number)
2. Number must be unique and sequential
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
- Jobs: process-reminders, run-optimization, send-confirmations, expire-offers, check-timeouts, cleanup-proposals, sync-calendars, kpi-snapshot, detect-no-shows, escalate-confirmations

**src/app/api/webhooks/**
- Purpose: Inbound webhooks (Twilio)
- Generated: No
- Committed: Yes
- Pattern: Use signature validation (Twilio request verification)

**src/app/api/admin/**
- Purpose: Admin-only endpoints for manual operations
- Generated: No
- Committed: Yes
- Pattern: trigger-backfill for manually starting backfill

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

*Structure analysis: 2026-03-09*
