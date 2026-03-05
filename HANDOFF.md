# Project Handoff — NowShow

> Last updated: 2026-03-06 00:30
> Session: Fixed critical backfill bug — waitlist_entries now included in candidate search

## Active Project

- **Path**: /Users/aiassistant/products/noshowzero-landing
- **Stack**: Next.js 15 + Supabase + Twilio WhatsApp + Claude AI
- **Branch**: `main`
- **Build status**: PASSING (76 pages, zero errors)
- **Production**: https://noshowzero-landing.vercel.app
- **Git remote**: https://github.com/mognefullmogne/noshowzero-landing.git

## What Was Done This Session

### P0 — Waitlist Backfill Bug Fixed (THE MAIN FIX)

**Root cause**: `findCandidates()` in `src/lib/backfill/find-candidates.ts` only searched the `appointments` table for patients with later appointments who could move earlier. It **never queried `waitlist_entries`**. Patients like Aimone Pitacco (on the waitlist with no existing appointment) were invisible to the backfill pipeline.

**Fix applied across 10 files**:

1. **`src/lib/backfill/find-candidates.ts`** — Core fix:
   - Updated `RankedCandidate` interface: added `source` (`'appointment'|'waitlist'`), `waitlistEntryId` (`string|null`), made `candidateAppointmentId` and `currentAppointmentAt` nullable
   - Added `OpenSlotDetails.serviceName` and `providerName` for waitlist matching
   - Added waitlist query: `waitlist_entries WHERE status='waiting' AND service_name=slot.serviceName`
   - Merges both candidate sources, deduplicates by patientId (appointment-based wins), sorts by score

2. **`src/lib/scoring/candidate-score.ts`** — `appointmentScheduledAt` accepts `Date | null`; waitlist candidates get distance score 45 (mid-high, "they benefit significantly from any slot")

3. **`src/lib/backfill/trigger-backfill.ts`** — Passes `serviceName` and `providerName` to `findCandidates`

4. **`src/lib/backfill/send-offer.ts`** — Uses `waitlistEntryId` in offer insert; null-safe `currentAppointmentAt` formatting

5. **`src/lib/twilio/templates.ts`** — WhatsApp template conditionally shows "Sei in lista di attesa per questo servizio." for waitlist candidates (instead of broken "Il tuo appuntamento attuale è il  alle .")

6. **`src/lib/backfill/process-response.ts`** — On accept, marks waitlist entry as `status: 'fulfilled'`

7. **`src/lib/backfill/preemptive-cascade.ts`** — Added `waitlistEntryId`/`source` to rebuilt candidates

8. **`src/lib/scoring/ai-candidate-ranker.ts`** — Null-safe `currentAppointmentAt` in AI prompt

9. **Test helpers** (2 files) — Added new `RankedCandidate` fields to `makeCandidate()`

### Work Method — Multi-Agent via cmux

This session used 5 parallel Claude Code agents via cmux split panes:
- **ORCHESTRATOR** (pane:1/surface:1) — main coordinator, dispatches tasks, reviews outputs, fixes issues
- **INVESTIGATOR** (pane:14/surface:14) — schema research, codebase scanning, null-safety audit
- **FRONTEND** (pane:15/surface:15) — available but not used this session
- **BACKEND** (pane:16/surface:16) — implemented core find-candidates.ts + trigger-backfill.ts + candidate-score.ts
- **AI ENGINE** (pane:17/surface:17) — implemented templates.ts conditional WhatsApp message
- **QA** (pane:18/surface:18) — ran type checks and build verification

## What Is In Progress

### UNCOMMITTED — 10 files modified, build passing
All changes are staged but NOT committed. Need to:
1. `git add` the 10 modified files
2. Commit with message: `fix: include waitlist_entries in backfill candidate search`
3. Push to main
4. Verify Vercel deployment

## What To Do Next

### P0 — Commit and Deploy
1. Commit the 10 modified files
2. Push to main → Vercel auto-deploys
3. Verify deployment succeeded

### P0 — End-to-End Test
1. Cancel an appointment (Taglio Uomo, Marco Stylist) via the dashboard
2. Verify Aimone Pitacco (waitlist entry b9c9d955, phone +393516761840) receives a WhatsApp offer
3. Check Twilio Console → Messaging → Logs for delivery status
4. Test the accept flow: reply SI → verify new appointment created + waitlist entry marked fulfilled

### P1 — Pre-existing Type Errors (not from our changes)
- `src/app/api/webhooks/twilio/__tests__/route.test.ts` has 6 TS2345 errors about `IntentResult` type
- These existed before our changes — separate fix needed

### P2 — Enhancements
- Add provider_name matching for waitlist entries (currently only service_name is matched)
- Consider waitlist entry `preferred_time_slots` and `flexible_time` when matching
- Add waitlist-specific scoring that factors in `clinical_urgency` from the entry itself

## Key Decisions Made

- **Waitlist candidates get appointmentDistance score 45** — mid-high range (equivalent to 14-30 day appointment). They benefit from any slot but don't automatically outrank 60-day appointment holders.
- **candidateAppointmentId is null for waitlist candidates** — prevents double-cancel bug in accept flow (process-response.ts already null-checks this)
- **Service name exact match** for waitlist→appointment matching (no fuzzy matching yet)
- **`satisfies` replaced with explicit return types** in map/filter chains to fix TS type predicate errors

## Known Issues & Gotchas

- **Pre-existing**: route.test.ts has 6 IntentResult type errors (not from our changes)
- **AI Rerank timeout at 3s** — math ranking fallback is safe, just log noise
- **`smart_score` null on waitlist entries** → scoring defaults are reasonable
- **Calendar sync for modified events** not yet implemented (new + cancelled only)
- **Preemptive cascade** only snapshots appointment-based candidates (waitlist candidates from prequalification would be silently dropped on re-fetch — low risk since prequalification runs on appointment data)

## Test Data

- Patient **Aimone Pitacco** (10ca6f7f) — phone +393516761840, WhatsApp
- Waitlist entry (b9c9d955) — Taglio Uomo, Marco Stylist, urgency=high, morning, waiting
- Cancelled appointment (ae7f695e) — Taglio Uomo, Marco Stylist, 16/03 09:00, cancelled
- Tenant: `e1d14300-10cb-42d0-9e9d-eb8fee866570`

## Files Changed (This Session)

### Backfill pipeline (core fix)
- `src/lib/backfill/find-candidates.ts` — RankedCandidate interface + waitlist query
- `src/lib/backfill/trigger-backfill.ts` — pass serviceName/providerName
- `src/lib/backfill/send-offer.ts` — waitlistEntryId + null-safe formatting
- `src/lib/backfill/process-response.ts` — waitlist entry fulfillment on accept
- `src/lib/backfill/preemptive-cascade.ts` — new interface fields

### Scoring & AI
- `src/lib/scoring/candidate-score.ts` — nullable appointmentScheduledAt
- `src/lib/scoring/ai-candidate-ranker.ts` — null-safe currentAppointmentAt

### Messaging
- `src/lib/twilio/templates.ts` — conditional WhatsApp template for waitlist

### Tests
- `src/lib/backfill/__tests__/trigger-backfill.test.ts` — added new fields
- `src/lib/scoring/__tests__/ai-candidate-ranker.test.ts` — added new fields

## Environment

- `.env.local` has all vars (Supabase, Stripe, Twilio, Anthropic)
- `TWILIO_WHATSAPP_NUMBER=whatsapp:+393399957337` (production, verified correct)
- `TWILIO_SMS_NUMBER=+393399957337`
- Supabase project: `hwxebnmrgrdzpfappyvk`

## How to Verify

```bash
npm run build          # Should pass, 76 pages
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "route.test.ts"  # Should be empty
git diff --stat        # 10 files, ~294 insertions, ~174 deletions
```

## cmux Agent Panes (if still open)

| Surface | Role | State |
|---------|------|-------|
| surface:1 | ORCHESTRATOR | main coordinator |
| surface:14 | INVESTIGATOR | idle, cleared |
| surface:15 | FRONTEND | idle, unused |
| surface:16 | BACKEND | idle, cleared |
| surface:17 | AI ENGINE | idle, cleared |
| surface:18 | QA | idle |
