# External Integrations

**Analysis Date:** 2025-03-03

## APIs & External Services

**Payment Processing:**
- Stripe - Subscription and payment management
  - SDK/Client: `stripe` v20.4.0 (server), `@stripe/stripe-js` v8.9.0 (client)
  - Auth: `STRIPE_SECRET_KEY` (server), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client)
  - Webhook verification: `STRIPE_WEBHOOK_SECRET`
  - Price IDs: 6 configured via env vars (Growth/Pro/Enterprise × Monthly/Annual)
  - Webhook endpoint: `/api/stripe/webhook`
  - Implementation: `src/lib/stripe.ts`, `src/app/api/stripe/webhook/route.ts`, `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/portal/route.ts`

**Messaging & Notifications:**
- Twilio - SMS, WhatsApp, Email notifications
  - SDK/Client: `twilio` v5.12.2
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
  - Numbers: `TWILIO_WHATSAPP_NUMBER`, `TWILIO_SMS_NUMBER`
  - Webhook endpoint: `/api/webhooks/twilio` (receives inbound WhatsApp/SMS)
  - Signature verification: `TWILIO_WEBHOOK_URL` (must be set for webhook verification)
  - Implementation: `src/lib/twilio/client.ts`, `src/lib/twilio/send-notification.ts`, `src/app/api/webhooks/twilio/route.ts`
  - Features: inbound message classification, intent routing, rate limiting (10 messages/60s per phone), signature verification

**AI & Language Models:**
- Anthropic (Claude) - AI chat, message classification, and risk scoring
  - SDK/Client: `@anthropic-ai/sdk` v0.78.0
  - Auth: `ANTHROPIC_API_KEY`
  - Models used:
    - `claude-sonnet-4-6` - Operator chat with agentic tools (max 10 iterations)
    - `claude-haiku-4-5-20251001` - Twilio webhook intent classification
  - Implementation: `src/lib/ai/operator-chat.ts`, `src/lib/ai/appointment-chat.ts`, `src/app/api/chat/route.ts`, `src/app/api/webhooks/twilio/route.ts`
  - Features: agentic loops with tool dispatch, timeout 10s for classification, structured output validation

**Calendar Integrations:**
- Google Calendar - Calendar read-only sync via OAuth 2.0
  - API: Google Calendar API v3
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Scope: `calendar.readonly` (read-only access)
  - Token refresh: Automatic via refresh token
  - Features: incremental sync via syncToken, pagination (250 events per request)
  - Implementation: `src/lib/integrations/google-calendar.ts`, `src/app/api/integrations/google/auth/route.ts`, `src/app/api/integrations/google/callback/route.ts`, `src/app/api/integrations/google/calendars/route.ts`

- Microsoft Outlook - Outlook Calendar read-only sync via OAuth 2.0
  - API: Microsoft Graph API v1.0
  - Auth: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
  - Scope: `Calendars.Read offline_access`
  - Token refresh: Automatic via refresh token
  - Features: delta sync via deltaLink, 6-month event window
  - Implementation: `src/lib/integrations/outlook-calendar.ts`, `src/app/api/integrations/microsoft/auth/route.ts` (if present), `src/app/api/integrations/[id]/route.ts`

## Data Storage

**Databases:**
- Supabase (PostgreSQL)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client), `SUPABASE_SERVICE_ROLE_KEY` (server)
  - Client: `@supabase/supabase-js` v2.98.0, `@supabase/ssr` v0.9.0
  - Implementation: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
  - Tables: tenants, users, patients, appointments, waitlist_entries, waitlist_offers, calendar_integrations, booking_sessions, audit_logs, workflow_definitions, etc.
  - Migrations: 11 SQL migrations in `supabase/migrations/`
  - Row-Level Security (RLS): Configured for multi-tenancy

**File Storage:**
- Local filesystem only - No external file storage configured
- CSV upload supported in `/api/integrations/csv/upload`

**Caching:**
- None detected - Supabase realtime subscriptions used for real-time updates

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Custom authentication via Supabase
  - Implementation: Supabase session-based auth via SSR middleware
  - Middleware: `src/middleware.ts` handles Supabase session refresh
  - Server client: `src/lib/supabase/server.ts` with cookie-based session management
  - Service role client: Used for backend operations with elevated permissions

**OAuth Integrations:**
- Google OAuth 2.0 - For Google Calendar sync
  - State parameter: CSRF protection via signed state token (`OAUTH_STATE_SECRET` or fallback to `OFFER_TOKEN_SECRET`)
  - Token encryption: AES-256-GCM (`INTEGRATION_ENCRYPTION_KEY`)
  - Implementation: `src/lib/integrations/oauth-state.ts`, `src/lib/integrations/encryption.ts`

- Microsoft OAuth 2.0 - For Outlook Calendar sync
  - State parameter: CSRF protection (same as Google)
  - Token encryption: AES-256-GCM
  - Implementation: Parallel to Google OAuth

## Monitoring & Observability

**Error Tracking:**
- None detected - Console logging only

**Logs:**
- Console.log() - Server-side logging via Node.js console
- No centralized logging service configured
- Key areas logged: Twilio webhook processing, AI classification, Stripe events, integration sync

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
- `STRIPE_PRICE_GROWTH_MONTHLY`, `STRIPE_PRICE_GROWTH_ANNUAL`
- `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`
- `STRIPE_PRICE_ENTERPRISE_MONTHLY`, `STRIPE_PRICE_ENTERPRISE_ANNUAL`

**Anthropic:**
- `ANTHROPIC_API_KEY` - Claude API key

**Twilio:**
- `TWILIO_ACCOUNT_SID` - Account identifier
- `TWILIO_AUTH_TOKEN` - Auth token
- `TWILIO_WHATSAPP_NUMBER` - WhatsApp sender number (format: `whatsapp:+14155238886`)
- `TWILIO_SMS_NUMBER` - SMS sender number (format: `+14155238886`)
- `TWILIO_WEBHOOK_URL` - Webhook URL for signature verification

**Google Calendar:**
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret

**Microsoft Outlook:**
- `MICROSOFT_CLIENT_ID` - OAuth client ID
- `MICROSOFT_CLIENT_SECRET` - OAuth client secret

**Encryption & Security:**
- `OFFER_TOKEN_SECRET` - 32-byte hex string for token signing
- `OAUTH_STATE_SECRET` - 32-byte hex string for OAuth CSRF state (falls back to OFFER_TOKEN_SECRET)
- `INTEGRATION_ENCRYPTION_KEY` - 64-char hex string (32 bytes) for AES-256-GCM token encryption

**Application:**
- `NEXT_PUBLIC_APP_URL` - Frontend URL (e.g., `http://localhost:3000`)
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
  - Processing: intent classification, patient lookup, appointment/offer status updates

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

**Scheduled Jobs (Vercel Cron):**
- Protected via `CRON_SECRET` environment variable
- Endpoints inferred but not specified in analyzed files

---

*Integration audit: 2025-03-03*
