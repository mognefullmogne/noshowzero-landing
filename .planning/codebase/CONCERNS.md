# Codebase Concerns

**Analysis Date:** 2026-03-03

## Critical Blockers

**Database Migrations Not Run:**
- Issue: Migrations 004-011 have not been applied to production Supabase. Required tables missing: `message_threads`, `message_events`, `delivery_statuses`, `appointment_slots`, `optimization_decisions`, `rulesets`, `rule_versions`, `audit_events`, `confirmation_workflows`, `slot_proposals`, `kpi_snapshots`, `failed_jobs`, `booking_sessions`, `oauth_integrations`, `import_logs`.
- Files: `scripts/combined_migrations_004_009.sql`, `supabase/migrations/010_booking_sessions.sql`, `supabase/migrations/011_integrations.sql`
- Impact: **BLOCKING** — Rules page shows "Database Setup Required", many features non-functional in production. Confirmed/WhatsApp workflows, booking sessions, calendar integrations, optimization engine all fail gracefully due to missing tables.
- Fix approach: User must run migrations via Supabase Dashboard SQL Editor or CLI. Requires valid DB connection string from Supabase Settings → Database → Connection string (URI tab). Once run, tables become available and features activate.

**Missing OAuth Credentials in Production:**
- Issue: Google OAuth, Microsoft OAuth, encryption keys not set in Vercel environment variables
- Files: `src/lib/integrations/oauth-flow.ts`, `src/lib/integrations/token-refresh.ts`
- Impact: Calendar integrations (Google Calendar, Outlook) will fail authorization redirects in production
- Fix approach: Set in Vercel Dashboard → Settings → Environment Variables:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (from console.cloud.google.com)
  - `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` (from portal.azure.com)
  - `INTEGRATION_ENCRYPTION_KEY` (generate: `openssl rand -hex 32`)
  - `OAUTH_STATE_SECRET` (generate: `openssl rand -hex 32`)

## Tech Debt

**In-Memory Rate Limiting — Serverless Incompatibility:**
- Issue: `phoneRateLimit` Map in `src/app/api/webhooks/twilio/route.ts` and `rateLimitMap` in `src/app/api/chat/route.ts` are per-instance only. On Vercel serverless, each request may hit a different instance with empty rate limit state.
- Files: `src/app/api/webhooks/twilio/route.ts` (lines 28-53), `src/app/api/chat/route.ts` (~line 20)
- Impact: Rate limiting fails silently in production. Spam/DDoS protection non-functional for WhatsApp webhook and chat API. Users can send unlimited messages.
- Fix approach: Move rate limiting to Redis (already available in dev) or Supabase RLS policies with timestamps. Create per-tenant rate limit tracking table, check/increment atomically.
- Priority: **HIGH** — Exposed to abuse

**Single Sync Token for Multi-Calendar Google Sync:**
- Issue: `src/lib/integrations/sync-engine.ts` line 136 uses a single `sync_token` for all selected Google calendars. Google Calendar API recommends per-calendar tokens for delta sync reliability.
- Files: `src/lib/integrations/sync-engine.ts` (lines 130-160), `src/lib/integrations/types.ts`
- Impact: If user selects 3 Google calendars, only the last one's sync token persists. Previous calendars re-fetch all events on next sync, causing duplicates and high API quota usage.
- Fix approach: Store `sync_tokens: Map<calendarId, token>` in integration record as JSON. Update per-calendar on each sync.
- Priority: **MEDIUM** — High API cost but not data-breaking

**Basic iCal RRULE Expansion:**
- Issue: `src/lib/integrations/ical-parser.ts` expands RRULE only for DAILY, WEEKLY, MONTHLY. Missing YEARLY, INTERVAL (e.g., every 2 weeks), BYDAY/BYMONTHDAY complex rules, and EXDATE/RDATE handling.
- Files: `src/lib/integrations/ical-parser.ts` (~lines 200-250)
- Impact: Recurring appointments from complex calendar feeds may be missed or expanded incorrectly, leading to no-show predictions on wrong dates.
- Fix approach: Replace with `rrule` npm package or extend expansion logic. Keep current for basic cases, fallback for unsupported rules.
- Priority: **MEDIUM** — Affects edge case calendars

**Type Safety with `unknown` and Loose Casting:**
- Issue: Multiple files use unsafe type casting `as unknown as Record<string, unknown>` to work around Supabase join types. No runtime validation.
- Files: `src/app/(app)/messages/page.tsx` (lines ~200, ~220), `src/app/(app)/calendar/page.tsx`, `src/app/api/offers/[offerId]/route.ts`, `src/app/api/appointments/[id]/send-confirmation/route.ts`, `src/app/api/appointments/[id]/remind/route.ts`
- Impact: Silent failures if Supabase returns unexpected structure. Typos in field access (e.g., `first_name` vs `firstName`) only caught at runtime.
- Fix approach: Define explicit join types in `src/lib/types.ts`. Use Zod schemas for runtime validation. Replace `unknown` casts with proper TypeScript interfaces.
- Priority: **MEDIUM** — Maintainability issue, not production-breaking yet

**Unused Console.error Calls in Production:**
- Issue: Scattered console.error calls throughout codebase (Twilio webhook, sync engine, etc.) which are non-functional on serverless.
- Files: `src/app/api/webhooks/twilio/route.ts` (lines 91, 97), `src/lib/integrations/sync-engine.ts` (line 123), and others
- Impact: Errors silently fail to log. Debugging production issues requires Vercel/Supabase logs, not app logs.
- Fix approach: Replace with structured logging (e.g., Pino, Winston) that writes to file/monitoring service. Remove or route to Supabase audit table.
- Priority: **MEDIUM** — Debugging blocker

## Known Bugs

**Multi-Patient Phone Number Handling:**
- Symptoms: WhatsApp bot confirms wrong appointment when multiple patients share same phone (partially fixed but edge cases remain)
- Files: `src/app/api/webhooks/twilio/route.ts` (lines ~260-290), `src/lib/booking/booking-orchestrator.ts`
- Trigger: Two patients with identical phone number; one sends "sì" to confirm
- Current state: Fixed via preference for pending appointments. But if both have pending appointments, arbitrary first match is used.
- Workaround: Validate patient intent via email confirmation or ask for DOB verification before appointment action
- Better fix: Require patient identifier (patient ID or email) in WhatsApp flow before action

**iCal Feed Validation Not URL-Safe:**
- Symptoms: iCal feed with redirects or authentication may fail silently
- Files: `src/lib/integrations/validate-ical-url.ts`
- Trigger: iCal URL requires HTTP authentication or redirects
- Current state: `validateICalUrl` fetches with basic `fetch()`, no redirect handling or timeout
- Workaround: User manually provides direct URL (not redirected)
- Fix approach: Follow redirects (5 max), support Basic-Auth via URL, add 10s timeout

**Infinite Scroll Load State in Integration Page:**
- Symptoms: When importing large CSV/iCal, "Loading..." spinner shows but may not update if sync takes >30s
- Files: `src/app/(app)/integrations/page.tsx` (lines ~400-500)
- Trigger: Large calendar import (>1000 events)
- Current state: No progress bar or polling. User sees "Loading" forever.
- Workaround: Reload page to see final state
- Fix approach: Add polling with `setInterval` for import log status, or WebSocket for real-time updates

## Security Considerations

**Unencrypted OAuth Tokens at Rest:**
- Risk: Google/Outlook access tokens stored in `calendar_integrations.oauth_token` column without encryption
- Files: `src/lib/integrations/token-refresh.ts`, `src/app/api/oauth/google/callback/route.ts`, `src/app/api/oauth/outlook/callback/route.ts`
- Current mitigation: Tokens expire (Google: 1h, Outlook: 1h) so exposure window is limited. Column is not exposed in safe SELECT queries.
- Recommendations:
  1. Encrypt tokens at rest using `INTEGRATION_ENCRYPTION_KEY` (AES-256-GCM) before INSERT
  2. Decrypt only when needed for API calls
  3. Implement token rotation + cleanup of expired tokens
  4. Add database-level encryption (Supabase Vault or PgCrypto)

**Input Validation on Appointment Status Updates:**
- Risk: Status transitions not validated. Any authenticated user can transition appointment to any status without business logic checks.
- Files: `src/app/api/appointments/[id]/route.ts` (lines ~80-120)
- Current mitigation: Supabase RLS policies (tenant_id isolation only)
- Recommendations:
  1. Add allowlist of valid transitions: scheduled→{reminder_pending,cancelled}, reminder_pending→{confirmed,declined,timeout}, etc.
  2. Validate appointment state preconditions (e.g., can't confirm past appointments)
  3. Audit all status changes to `audit_events` table (once migrations run)

**Unvalidated AI Classification Input:**
- Risk: WhatsApp/SMS message is truncated (500 chars) but no schema validation on Claude response
- Files: `src/lib/messaging/intent-engine.ts`, `src/app/api/webhooks/twilio/route.ts` (lines ~130-160)
- Current mitigation: Prompt injection attempt still sanitized via `sanitizeForAI()`. Claude response validated against intent enum via `VALID_INTENTS` set.
- Recommendations:
  1. Use Claude's structured output / tools API instead of free-form JSON
  2. Add timeout (5s) and retry logic (2x) for intent classification
  3. Log all classification mismatches for model fine-tuning

**CSRF Token Not Persistent in OAuth State:**
- Risk: `OAUTH_STATE_SECRET` is single shared secret. No per-request state tokens.
- Files: `src/app/api/oauth/google/start/route.ts`, `src/app/api/oauth/google/callback/route.ts`
- Current mitigation: State parameter included but not cryptographically validated per-request
- Recommendations:
  1. Generate cryptographic state token per-request, store in secure HTTP-only cookie
  2. Validate state matches cookie on callback
  3. Add CSRF-aware session handling

**Twilio Webhook Signature Verification:**
- Risk: Verification relies on environment variable `TWILIO_WEBHOOK_URL` not deriving from request
- Files: `src/app/api/webhooks/twilio/route.ts` (lines 88-98)
- Current mitigation: TWILIO_WEBHOOK_URL hardcoded/configured server-side, never from request
- Recommendations: Good — continue this approach. Consider adding Twilio request ID validation as second factor.

## Performance Bottlenecks

**N+1 Queries in Import Flow:**
- Problem: For each calendar event, separate queries for `appointments` (check existing), patient stats (totalAppts, noShows)
- Files: `src/lib/integrations/appointment-importer.ts` (lines 54-93)
- Cause: Sequential per-event lookups in loop instead of bulk operations
- Improvement path:
  1. Batch check existing appointments: `WHERE external_id IN (...)` before loop
  2. Pre-fetch all patient stats in one query, cache in Map
  3. Batch insert reminders (currently done, good)
  4. Reduces import time from O(n) to O(1) external_id lookups

**Unoptimized Waitlist Matching Query:**
- Problem: `findBestCandidate()` doesn't use indexed columns for filtering
- Files: `src/lib/backfill/find-candidates.ts`
- Cause: Smart score calculation is in-memory; filters on unindexed `smart_score` and `clinical_urgency` columns
- Improvement path:
  1. Add indexes on `waitlist_entries(service_code, status, created_at)`
  2. Pre-materialize smart scores in `smart_score` column (already done, good)
  3. Add database-level sorting, not application-level

**No Connection Pooling for Supabase:**
- Problem: Each API route creates new Supabase client via `createClient()`
- Files: `src/lib/supabase/server.ts`
- Cause: Supabase SDK doesn't reuse PostgREST connections across requests
- Impact: Cold start on first request, new TCP handshake each time
- Improvement path:
  1. Use Supabase connection pooler (pgBouncer) — set in `DATABASE_URL` to `...?sslmode=require`
  2. Cache client in singleton or request context
  3. Current Supabase plan likely includes pooling; enable in settings

**Real-Time Sync Without Polling Backoff:**
- Problem: Cron syncs (`/api/cron/sync-calendars`) run every 15 min regardless of integration health
- Files: `src/lib/integrations/sync-engine.ts`
- Cause: No exponential backoff for failing integrations
- Impact: Quota exhaustion on broken OAuth tokens, logs spam
- Improvement path:
  1. Track consecutive failures per integration
  2. Exponential backoff: 15min → 1h → 6h → 24h for persistent errors
  3. Alert operator after 3 consecutive failures
  4. Resume full sync once one successful sync completes

## Fragile Areas

**Calendar OAuth Token Refresh Logic:**
- Files: `src/lib/integrations/token-refresh.ts`
- Why fragile: Assumes expiry time accurate; no handling of revoked tokens, scope changes, or provider API breaks
- Safe modification: Mock token refresh in tests; verify both valid refresh and expired token paths; add retry logic
- Test coverage: Need unit tests for token expiry calculation, refresh failure modes, silent revocation detection

**iCal Parser — Loose RFC 5545 Compliance:**
- Files: `src/lib/integrations/ical-parser.ts`
- Why fragile: Hand-rolled parser with regex-based RRULE expansion, no formal spec validation
- Safe modification: Add parser unit tests for each RFC 5545 component; consider switching to `ical.js` library; fuzz-test with malformed feeds
- Test coverage: Currently untested; need edge case coverage for escaped characters, timezone handling, encoding issues

**Supabase RLS Policy for Tenant Isolation:**
- Files: Database RLS policies (not in source; check Supabase dashboard)
- Why fragile: Single `tenant_id = auth.uid()` claim in JWT. If JWT generation breaks, entire data isolation breaks.
- Safe modification: Audit JWT generation in `getAuthenticatedTenant()` helper; add integration tests for cross-tenant access attempt; verify RLS policies via Supabase API
- Test coverage: Need end-to-end test simulating tenant A accessing tenant B's data

**WhatsApp Intent Classification Fallback:**
- Files: `src/lib/messaging/intent-engine.ts`, `src/app/api/webhooks/twilio/route.ts`
- Why fragile: If Claude API is down, message processing halts with no graceful fallback
- Safe modification: Add regex-only classification (hardcoded: "sí/yes"→confirm, "no"→cancel) as fallback; log API errors separately
- Test coverage: Need mock for Anthropic API failure; verify fallback kicks in

## Scaling Limits

**In-Memory Rate Limiter — Per-Instance:**
- Current capacity: ~1000 phone numbers tracked per instance (before memory exhaustion)
- Limit: Serverless instances recycled every ~15 min on Vercel. Rate limit map discarded.
- Scaling path: Move to Redis (via Supabase Redis add-on or external Redis) with TTL, or use Supabase RLS + timestamps

**Single-Threaded iCal Sync for Multiple Integrations:**
- Current capacity: 10 integrations per tenant, ~500 events per calendar
- Limit: `syncAllActiveIntegrations()` runs sequentially. Large imports block cron task (timeout risk on Vercel's 60s limit for background functions)
- Scaling path: Use job queue (BullMQ, Firebase Tasks, or Supabase pg_cron for triggers) for parallel syncs

**Appointment Import — Sequential Event Processing:**
- Current capacity: ~500 events per sync before timeout
- Limit: Loop processes events one-by-one; each event → 2 DB queries + risk scoring
- Scaling path: Batch inserts (50 at a time), parallel risk scoring, pre-calculated stats Map

**Waitlist Smart Score Calculation — In-Memory Stats Map:**
- Current capacity: ~10k waitlist entries before slow aggregation
- Limit: `findBestCandidate()` loops through all candidates and calculates stats in JS
- Scaling path: Pre-materialize smart scores in database (already done for latest matching), add materialized view for fast filtering

## Test Coverage Gaps

**Integration Sync Error Handling:**
- What's not tested: Google API 403 (token revoked), Outlook API 429 (rate limited), malformed iCal feed
- Files: `src/lib/integrations/sync-engine.ts`, `src/lib/integrations/google-calendar.ts`, `src/lib/integrations/outlook-calendar.ts`
- Risk: Sync breaks silently, integration stuck in "error" state, user never notified
- Priority: **HIGH** — Affects data completeness

**WhatsApp Multi-Patient Message Handling:**
- What's not tested: Multiple patients with same phone; both have pending appointments
- Files: `src/app/api/webhooks/twilio/route.ts`, `src/lib/booking/booking-orchestrator.ts`
- Risk: Confirms wrong patient's appointment
- Priority: **HIGH** — Data correctness

**CSV Import Deduplication:**
- What's not tested: Duplicate IDs in CSV; deterministic ID generation collisions
- Files: `src/lib/integrations/csv-parser.ts`
- Risk: CSV imported twice creates duplicate appointments
- Priority: **MEDIUM** — Data quality

**OAuth Callback State Validation:**
- What's not tested: Attacker-supplied state parameter; CSRF replay
- Files: `src/app/api/oauth/google/callback/route.ts`, `src/app/api/oauth/outlook/callback/route.ts`
- Risk: Token leakage via CSRF
- Priority: **HIGH** — Security

**Database Connection Retry Logic:**
- What's not tested: Supabase connection timeout; partial failure on bulk insert
- Files: API routes (all `createClient()` calls)
- Risk: Transient DB errors kill request without retry
- Priority: **MEDIUM** — Reliability

**Timezone Handling in Appointment Scheduling:**
- What's not tested: Daylight saving time transitions, user timezone vs event timezone
- Files: `src/lib/integrations/appointment-importer.ts`, `src/lib/booking/date-parser.ts`
- Risk: Appointment scheduled at wrong time
- Priority: **MEDIUM** — Data correctness

## Missing Critical Features

**No Audit Trail:**
- Problem: No logging of status changes, API access, or who modified what
- Blocks: Compliance requirements, debugging production issues
- Needs: `audit_events` table (migration 004) implementation in API routes

**No Idempotency for Webhooks:**
- Problem: Twilio webhook retries can cause duplicate message processing
- Blocks: At-most-once delivery guarantee
- Needs: `message_event_id` deduplication on incoming webhook

**No Alert System for Failures:**
- Problem: If calendar sync fails 3x in a row, no operator notification
- Blocks: SLA commitments, user trust
- Needs: Email/Slack integration for integration health monitoring

**No Calendar Export/Sync Out:**
- Problem: Appointments created in NowShow not synced back to Google Calendar/Outlook
- Blocks: User workflow (appointment confirmations don't appear in their calendar)
- Needs: Reverse sync logic, webhook listening for appointment status changes

---

*Concerns audit: 2026-03-03*
