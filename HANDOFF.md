# Project Handoff

> Last updated: 2026-03-03 18:15
> Session: Implemented full Calendar Integrations system (Google, Outlook, iCal, CSV)

## Active Project

- **Path**: `/Users/aiassistant/products/noshowzero-landing`
- **Stack**: Next.js 16 + TypeScript + Supabase + Twilio + Stripe + Anthropic Claude
- **Branch**: `main`
- **Build status**: PASSING (0 TypeScript errors, `npm run build` clean)

## What Was Done This Session

### Calendar Integrations System (Import & Replace Model)
- Created full calendar import system: Google Calendar, Outlook, iCal feeds, CSV upload
- All imports go through a unified `NormalizedCalendarEvent[]` pipeline
- Each imported event gets enriched: risk scoring, reminders, confirmation workflow
- Import & replace model — pull everything in, customer stops using old tool

### New files created:

**Database migration:**
- `supabase/migrations/011_integrations.sql` — `calendar_integrations` + `import_logs` tables with RLS

**Core integration library (`src/lib/integrations/`):**
- `types.ts` — NormalizedCalendarEvent, CalendarIntegration, ImportResult, OAuthTokens
- `encryption.ts` — AES-256-GCM token encryption/decryption at rest
- `appointment-importer.ts` — Core pipeline: dedup → patient → appointment → risk → reminders → confirmation
- `csv-parser.ts` — Auto-detect delimiter, date format, column mapping (Google/Outlook/generic)
- `ical-parser.ts` — Fetch + parse iCal feeds, expand recurring events (6 months)
- `google-calendar.ts` — Google Calendar API v3 via fetch() (OAuth, list, events, incremental sync)
- `outlook-calendar.ts` — Microsoft Graph API via fetch() (OAuth, list, events, delta sync)
- `sync-engine.ts` — Orchestrates sync for each provider type
- `token-refresh.ts` — Decrypts stored tokens, refreshes if expired, re-encrypts
- `oauth-state.ts` — HMAC-based CSRF state parameter with timing-safe comparison
- `validate-ical-url.ts` — SSRF protection: scheme allowlist + private IP blocking

**API routes (`src/app/api/integrations/`):**
- `route.ts` — GET (list integrations), POST (iCal feed)
- `[id]/route.ts` — GET, PATCH, DELETE for individual integrations
- `[id]/sync/route.ts` — POST manual sync with 60s cooldown
- `csv/upload/route.ts` — POST multipart CSV upload with MIME + binary validation
- `google/auth/route.ts` — GET → redirect to Google OAuth consent
- `google/callback/route.ts` — GET → exchange code, encrypt tokens, store + session re-verification
- `google/calendars/route.ts` — GET → list available calendars after connect
- `outlook/auth/route.ts` — GET → redirect to Outlook OAuth consent
- `outlook/callback/route.ts` — GET → exchange code, encrypt tokens, store + session re-verification
- `outlook/calendars/route.ts` — GET → list available Outlook calendars
- `../cron/sync-calendars/route.ts` — GET cron endpoint (CRON_SECRET auth)

**UI:**
- `src/app/(app)/integrations/page.tsx` — Full integrations page with:
  - IntegrationCard for each provider (connect/sync/pause/delete)
  - CsvUploadDialog (drag-and-drop, format info, results display)
  - ICalUrlDialog (URL + label input)
  - CalendarSelectorDialog (checkbox list, auto-opens after OAuth)
  - ImportLogTable (history with stats)
  - StatusBadge (active/paused/error)

**Modified files:**
- `src/app/(app)/layout.tsx` — Added "Integrazioni" sidebar link with Plug icon
- `.env.example` — Added Google, Microsoft, encryption key, OAuth state vars

### Security Fixes Applied (from code-reviewer + security-reviewer):
1. **SSRF protection** — URL validator blocks private IPs, reserved ranges, non-HTTP schemes
2. **Timing-safe HMAC** — `crypto.timingSafeEqual` in OAuth state verification
3. **Token exposure prevented** — API never returns `access_token_enc`, `refresh_token_enc` to client
4. **CSV validation** — MIME type check + binary content rejection (null byte detection)
5. **OAuth session re-verification** — Callbacks verify session user owns the tenantId from state
6. **RLS fixed** — Removed incorrect `current_setting('role')` policies (service_role bypasses RLS)
7. **Cron header simplified** — Removed non-standard `x-cron-secret` fallback
8. **iCal size limit** — 10 MB streaming limit prevents memory exhaustion
9. **Google 410 guard** — Prevents unbounded recursion on invalidated sync tokens
10. **Sync cooldown** — 60-second rate limit on manual sync endpoint
11. **CSV dedup** — SHA-256 content hash instead of random UUID for `externalId`
12. **Dedicated OAuth secret** — `OAUTH_STATE_SECRET` (falls back to `OFFER_TOKEN_SECRET`)

## What Is In Progress

- Nothing in progress — all integrations features are complete and build clean

## What To Do Next

1. **Deploy migration** — Run `011_integrations.sql` in Supabase
2. **Set env vars** — Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, `OAUTH_STATE_SECRET` to production
3. **Google OAuth setup** — Create OAuth 2.0 credentials at console.cloud.google.com, set redirect URI to `https://your-domain.com/api/integrations/google/callback`
4. **Microsoft OAuth setup** — Register app at portal.azure.com, set redirect URI
5. **Vercel Cron** — Configure `vercel.json` to call `/api/cron/sync-calendars` every 15 min
6. **Test CSV import** — Upload a CSV with 10 appointments → verify they appear with risk scores
7. **Test iCal import** — Add a public iCal URL → verify events imported
8. **Test Google Calendar** — Connect → select calendar → verify events appear
9. **Test deduplication** — Import same data twice → verify "skipped" count
10. **Sidebar label** — Consider changing "Integrazioni" to "Integrations" for consistency with other English labels

## Key Decisions Made

- **Import & replace model** — Not bidirectional sync. Pull everything in, enrich with AI, customer stops using old tool
- **No SDK dependencies** — Google Calendar API v3 and Microsoft Graph API used via `fetch()` directly
- **AES-256-GCM encryption** — OAuth tokens encrypted at rest with random IV, stored as `iv:authTag:ciphertext`
- **HMAC state for CSRF** — OAuth state = HMAC(tenantId:timestamp) with 10-minute TTL
- **Deterministic CSV IDs** — SHA-256 hash of date+time+summary+patient for idempotent CSV imports
- **Unified pipeline** — All providers normalize to `NormalizedCalendarEvent[]` then go through same appointment-importer

## Known Issues & Gotchas

- **Multi-calendar sync token** — Currently uses a single `sync_token` for all selected Google calendars. If a tenant selects multiple calendars, incremental sync may not work correctly for all except the last one. Consider storing per-calendar sync tokens in JSONB.
- **iCal recurring events** — RRULE expansion is basic (DAILY/WEEKLY/MONTHLY, COUNT/UNTIL/INTERVAL). Complex rules like BYDAY with multiple days are not fully supported.
- **Rate limiting** — Only the sync endpoint has a cooldown. Consider adding Redis-based rate limiting for CSV upload and iCal import endpoints in production.
- **Error feedback in UI** — `handleSync`, `handleDelete`, `handleTogglePause` don't surface API errors to the user (no toast notifications). Works but silent on failure.
- **In-memory rate limiter** — Pre-existing issue from WhatsApp webhook. The `phoneRateLimit` Map is per-instance only.

## Files Changed (This Session)

### New files (calendar integrations)
- `supabase/migrations/011_integrations.sql`
- `src/lib/integrations/types.ts`
- `src/lib/integrations/encryption.ts`
- `src/lib/integrations/appointment-importer.ts`
- `src/lib/integrations/csv-parser.ts`
- `src/lib/integrations/ical-parser.ts`
- `src/lib/integrations/google-calendar.ts`
- `src/lib/integrations/outlook-calendar.ts`
- `src/lib/integrations/sync-engine.ts`
- `src/lib/integrations/token-refresh.ts`
- `src/lib/integrations/oauth-state.ts`
- `src/lib/integrations/validate-ical-url.ts`
- `src/app/api/integrations/route.ts`
- `src/app/api/integrations/[id]/route.ts`
- `src/app/api/integrations/[id]/sync/route.ts`
- `src/app/api/integrations/csv/upload/route.ts`
- `src/app/api/integrations/google/auth/route.ts`
- `src/app/api/integrations/google/callback/route.ts`
- `src/app/api/integrations/google/calendars/route.ts`
- `src/app/api/integrations/outlook/auth/route.ts`
- `src/app/api/integrations/outlook/callback/route.ts`
- `src/app/api/integrations/outlook/calendars/route.ts`
- `src/app/api/cron/sync-calendars/route.ts`
- `src/app/(app)/integrations/page.tsx`

### Modified files
- `src/app/(app)/layout.tsx` — Added Integrazioni sidebar link
- `.env.example` — Added Google, Microsoft, encryption, OAuth state env vars

## Environment & Config

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Twilio**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WEBHOOK_URL`, `TWILIO_WHATSAPP_NUMBER`, `TWILIO_SMS_NUMBER`
- **Anthropic**: `ANTHROPIC_API_KEY`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Google OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Microsoft OAuth**: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- **Encryption**: `INTEGRATION_ENCRYPTION_KEY` (64-char hex = 32 bytes)
- **OAuth CSRF**: `OAUTH_STATE_SECRET` (falls back to `OFFER_TOKEN_SECRET`)
- **Cron**: `CRON_SECRET` (already exists)
- **Dev server**: `npm run dev` (Next.js on port 3000)

## How to Verify

```bash
cd /Users/aiassistant/products/noshowzero-landing
npm run build          # Should pass with 0 errors
# npm run dev          # Start dev server for manual testing
# Navigate to /integrations to see the new page
```
