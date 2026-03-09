# External Integrations

**Analysis Date:** 2026-03-09

## APIs & External Services

**Payment Processing:**
- Stripe - Subscription and payment management
  - SDK/Client: `stripe` v20.4.0 (server), `@stripe/stripe-js` v8.9.0 (client)
  - Auth: `STRIPE_SECRET_KEY` (server), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client)
  - Webhook verification: `STRIPE_WEBHOOK_SECRET`
  - Plans: Starter €90/mo, Growth €160/mo, Enterprise €499/mo (annual: €864, €1,536, €4,790)
  - Price IDs: 6 configured via env vars (Starter/Growth/Enterprise × Monthly/Annual)
  - Trial: 14 days
  - Webhook endpoint: `/api/stripe/webhook`
  - Implementation: `src/lib/stripe.ts`, `src/lib/constants.ts`, `src/app/api/stripe/webhook/route.ts`, `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/portal/route.ts`

**Messaging & Notifications:**
- Twilio - SMS, WhatsApp, Email notifications
  - SDK/Client: `twilio` v5.12.2
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
  - WhatsApp number: `whatsapp:+393399957337` (purchased, Italian)
  - Messaging Service SID: `MG2b3b5573ab7a04bf5428a5c563846fe7`
  - Content Templates (Meta-approved):
    - `appointment_notification`: HX872e96ad30837f3d313731ab657376f6
    - `appointment_confirmation`: HX692673826556aac6f477f66f3a5831a9
    - `backfill_offer`: HX9fd4c0a9fcece8d9f3d66df6cc1766de
    - `appointment_reminder`: HXc7700b93275ace01bfbc8a8db18457d5
    - `confirmation_reminder`: HXf7add83bca4873f99116783359884703
  - Webhook endpoint: `/api/webhooks/twilio` (receives inbound WhatsApp/SMS)
  - Signature verification: HMAC-SHA1 via `x-twilio-signature` header
  - Rate limiting: 10 messages/60s per phone (in-memory)
  - Implementation: `src/lib/twilio/client.ts`, `src/lib/twilio/send-notification.ts`, `src/lib/twilio/templates.ts`, `src/lib/twilio/content-templates.ts`, `src/app/api/webhooks/twilio/route.ts`, `src/lib/webhooks/twilio-verify.ts`

**AI & Language Models:**
- Anthropic (Claude) - 12 AI use cases across the platform
  - SDK/Client: `@anthropic-ai/sdk` v0.78.0
  - Auth: `ANTHROPIC_API_KEY`
  - Models used:
    - `claude-sonnet-4-6` — strategic reasoning, agentic loops, daily briefings
    - `claude-sonnet-4-5` — deep analytical tasks (no-show root cause)
    - `claude-haiku-4-5-20251001` — fast classification, scoring, parsing, personalization
  - Every AI call has a deterministic fallback (no hard failures)
  - All user inputs capped at 200-500 chars, control characters stripped

  **Use cases (Sonnet 4.6):**

  | # | Use Case | File | Max Tokens | Temp | Timeout | Caching |
  |---|----------|------|-----------|------|---------|---------|
  | 1 | Decision Engine — strategic cascade reasoning | `src/lib/ai/decision-engine.ts` | 600 | 0 | 5s | none |
  | 2 | Operator Chat — Italian agentic assistant with tools (10 iterations) | `src/lib/ai/operator-chat.ts` | 4,096 | default | none | none |
  | 3 | Appointment Chat — context-enriched wrapper for operator chat | `src/lib/ai/appointment-chat.ts` | 4,096 | default | none | none |
  | 4 | Morning Briefing — daily actionable insights for staff | `src/lib/ai/morning-briefing.ts` | 500 | default | 15s | **1h TTL** |

  **Use cases (Sonnet 4.5):**

  | # | Use Case | File | Max Tokens | Temp | Timeout | Caching |
  |---|----------|------|-----------|------|---------|---------|
  | 5 | No-Show Analysis — 90-day pattern root cause analysis | `src/lib/ai/no-show-analysis.ts` | 1,500 | default | 30s | **24h TTL** |

  **Use cases (Haiku 4.5):**

  | # | Use Case | File | Max Tokens | Temp | Timeout | Caching |
  |---|----------|------|-----------|------|---------|---------|
  | 6 | Patient Memory — extract preferences from WhatsApp messages | `src/lib/ai/patient-memory.ts` | 200 | default | 8s | none |
  | 7 | Intent Classification — fallback for unknown/question intents | `src/lib/webhooks/message-router.ts` | 300 | default | 10s | none |
  | 8 | Date Parsing — Italian natural language to ISO dates | `src/lib/booking/date-parser.ts` | 100 | default | 10s | none |
  | 9 | Confirmation Personalizer — risk-tiered Italian messages | `src/lib/scoring/ai-confirmation-personalizer.ts` | 256 | 0 | 3s | none |
  | 10 | Candidate Ranking — AI re-rank top 10 cascade candidates | `src/lib/scoring/ai-candidate-ranker.ts` | 512 | 0 | 3s | none |
  | 11 | Risk Scoring — enhance deterministic scores for 3+ history patients | `src/lib/scoring/ai-risk-score.ts` | 256 | 0 | none | none |
  | 12 | Public Website Chat — product Q&A chatbot on landing page | `src/app/api/chat/route.ts` | 500 | default | none | none |

  **Additional AI-adjacent orchestration (no direct Claude call):**
  - Patient Bot (`src/lib/messaging/patient-bot.ts`) — orchestrates intent→action→memory; calls AI only if regex confidence <0.6
  - Overbooking Analysis (`src/lib/intelligence/overbooking.ts`) — purely statistical, no AI

**Calendar Integrations:**
- Google Calendar - Calendar read-only sync via OAuth 2.0
  - API: Google Calendar API v3
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - OAuth client: `562303550910-8e1blcdrm71i0d3f5k14nsrj3atfudfb.apps.googleusercontent.com`
  - Scope: `calendar.readonly` (read-only access)
  - Token refresh: Automatic via refresh token
  - Token encryption: AES-256-GCM (`INTEGRATION_ENCRYPTION_KEY`)
  - Features: incremental sync via syncToken, per-calendar sync tokens, pagination (250 events/request)
  - Sync: poll-based via cron (every 30 min) + manual sync button
  - Implementation: `src/lib/integrations/google-calendar.ts`, `src/app/api/integrations/google/auth/route.ts`, `src/app/api/integrations/google/callback/route.ts`, `src/app/api/integrations/google/calendars/route.ts`

- Microsoft Outlook - Outlook Calendar read-only sync via OAuth 2.0
  - API: Microsoft Graph API v1.0
  - Auth: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` (NOT YET CONFIGURED)
  - Scope: `Calendars.Read offline_access`
  - Token refresh: Automatic via refresh token
  - Features: delta sync via deltaLink, 6-month event window
  - Implementation: `src/lib/integrations/outlook-calendar.ts`, `src/app/api/integrations/[id]/route.ts`

## Data Storage

**Databases:**
- Supabase (PostgreSQL 16)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client), `SUPABASE_SERVICE_ROLE_KEY` (server)
  - Client: `@supabase/supabase-js` v2.98.0, `@supabase/ssr` v0.9.0
  - Implementation: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
  - Tables: tenants, users, patients, appointments, waitlist_entries, waitlist_offers, calendar_integrations, booking_sessions, audit_events, audit_logs, workflow_definitions, confirmation_workflows, message_threads, message_events, kpi_snapshots, slot_proposals, optimization_actions
  - Migrations: 19 SQL migrations in `supabase/migrations/` (001–019)
  - Row-Level Security (RLS): Configured for multi-tenancy
  - Realtime: WebSocket subscriptions for live dashboard updates

**File Storage:**
- Local filesystem only - No external file storage configured
- CSV upload supported in `/api/integrations/csv/upload`

**Caching:**
- In-memory TTL caching (module-level Maps, reset on cold start):
  - Morning briefing: 1-hour TTL per tenant+date (`src/lib/ai/morning-briefing.ts`)
  - No-show analysis: 24-hour TTL per tenant (`src/lib/ai/no-show-analysis.ts`)
- Rate limiting: in-memory counters (chat: 20 req/60s per IP, Twilio: 10 msg/60s per phone)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Session-based auth via SSR middleware
  - Google OAuth sign-in enabled (via Supabase Management API)
  - Implementation: Supabase session-based auth via SSR middleware
  - Middleware: `src/middleware.ts` handles Supabase session refresh
  - Server client: `src/lib/supabase/server.ts` with cookie-based session management
  - Service role client: Used for backend operations with elevated permissions

**OAuth Integrations:**
- Google OAuth 2.0 - For Google Calendar sync + sign-in
  - State parameter: CSRF protection via signed state token (`OAUTH_STATE_SECRET` or fallback to `OFFER_TOKEN_SECRET`)
  - Token encryption: AES-256-GCM (`INTEGRATION_ENCRYPTION_KEY`)
  - Implementation: `src/lib/integrations/oauth-state.ts`, `src/lib/integrations/encryption.ts`

- Microsoft OAuth 2.0 - For Outlook Calendar sync
  - State parameter: CSRF protection (same as Google)
  - Token encryption: AES-256-GCM
  - Implementation: Parallel to Google OAuth (NOT YET CONFIGURED)

## Monitoring & Observability

**Error Tracking:**
- None detected - Console logging only

**Logs:**
- Console.log() - Server-side logging via Node.js console
- No centralized logging service configured
- Key areas logged: Twilio webhook processing, AI classification, Stripe events, integration sync, cascade decisions

**Audit Trail:**
- `audit_events` table — logs AI decisions, cascade actions, offer lifecycle
- `audit_logs` table — general system audit trail

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js native platform)
  - Configuration: `vercel.json`
  - Preview deployments on pull requests
  - Automatic main branch deployments

**CI Pipeline:**
- None detected - Vercel automatic deployments on git push
- ESLint configured for code quality

## Environment Configuration

**Required env vars (from `.env.example`):**

**Supabase:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key (public, safe for client)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-only, secret)

**Stripe:**
- `STRIPE_SECRET_KEY` - Server-side secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Client-side public key
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification
- `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_ANNUAL`
- `STRIPE_PRICE_GROWTH_MONTHLY`, `STRIPE_PRICE_GROWTH_ANNUAL`
- `STRIPE_PRICE_ENTERPRISE_MONTHLY`, `STRIPE_PRICE_ENTERPRISE_ANNUAL`

**Anthropic:**
- `ANTHROPIC_API_KEY` - Claude API key

**Twilio:**
- `TWILIO_ACCOUNT_SID` - Account identifier
- `TWILIO_AUTH_TOKEN` - Auth token
- `TWILIO_WHATSAPP_NUMBER` - WhatsApp sender number (format: `whatsapp:+393399957337`)
- `TWILIO_SMS_NUMBER` - SMS sender number
- `TWILIO_MESSAGING_SERVICE_SID` - Messaging Service SID (`MG2b3b5573ab7a04bf5428a5c563846fe7`)
- `TWILIO_WEBHOOK_URL` - Webhook URL for signature verification

**Google Calendar:**
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret

**Microsoft Outlook:**
- `MICROSOFT_CLIENT_ID` - OAuth client ID (NOT YET CONFIGURED)
- `MICROSOFT_CLIENT_SECRET` - OAuth client secret (NOT YET CONFIGURED)

**Encryption & Security:**
- `OFFER_TOKEN_SECRET` - 32-byte hex string for token signing
- `OAUTH_STATE_SECRET` - 32-byte hex string for OAuth CSRF state (falls back to OFFER_TOKEN_SECRET)
- `INTEGRATION_ENCRYPTION_KEY` - 64-char hex string (32 bytes) for AES-256-GCM token encryption

**Application:**
- `NEXT_PUBLIC_APP_URL` - Frontend URL (e.g., `https://noshowzero-landing.vercel.app`)
- `ADMIN_EMAIL` - Admin contact email
- `CRON_SECRET` - Random string for cron job protection (Vercel)

**Workflow Timeouts:**
- `CONFIRMATION_TIMEOUT_HOURS` - Appointment confirmation deadline (default: 24)
- `CONFIRMATION_SEND_HOURS_BEFORE` - Send confirmation X hours before (default: 48)
- `OPTIMIZATION_AUTO_APPLY_THRESHOLD` - Auto-apply optimization decisions with score >= this (default: 90)

**Secrets location:**
- Development: `.env.local` (git-ignored)
- Production: Vercel Environment Variables dashboard

## Webhooks & Callbacks

**Incoming Webhooks:**
- `/api/webhooks/twilio` (POST) - Inbound WhatsApp/SMS messages from Twilio
  - Signature verification: HMAC-SHA1 via `x-twilio-signature` header
  - Response format: TwiML (XML)
  - Processing: intent classification (regex → AI fallback), patient lookup, appointment/offer status updates, memory extraction

- `/api/stripe/webhook` (POST) - Stripe events
  - Signature verification: HMAC-SHA256 via `stripe-signature` header
  - Handled events:
    - `checkout.session.completed` - Update tenant plan after checkout
    - `customer.subscription.updated` - Sync subscription status (active/trialing/past_due/canceled)
    - `customer.subscription.deleted` - Mark plan as canceled
    - `invoice.payment_failed` - Mark plan as past_due

**Outgoing Webhooks/Callbacks:**
- Google Calendar OAuth callback: `/api/integrations/google/callback` (handles authorization code)
- Outlook Calendar OAuth callback: Implied in integrations flow

**Scheduled Jobs (Vercel Cron) — 10 jobs:**

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/process-reminders` | `0 * * * *` | Hourly appointment reminders |
| `/api/cron/send-confirmations` | `0 * * * *` | Hourly confirmation messages |
| `/api/cron/escalate-confirmations` | `*/30 * * * *` | 3-touch escalation ladder |
| `/api/cron/check-timeouts` | `*/15 * * * *` | Appointment timeout detection |
| `/api/cron/expire-offers` | `*/10 * * * *` | Cascade offer expiry + next candidate |
| `/api/cron/detect-no-shows` | `*/15 * * * *` | No-show detection → backfill trigger |
| `/api/cron/run-optimization` | `*/30 * * * *` | Pre-emptive cascade for critical risk |
| `/api/cron/sync-calendars` | `*/30 * * * *` | Google/Outlook calendar sync |
| `/api/cron/kpi-snapshot` | `0 0 * * *` | Daily metrics aggregation |
| `/api/cron/cleanup-proposals` | `0 3 * * *` | Expire stale slot proposals |

All cron jobs protected via `CRON_SECRET` environment variable.

---

*Integration audit: 2026-03-09*
