# Project Handoff — NoShowZero

> Last updated: 2026-03-05 23:30
> Session: Full autonomy — DELETE race fix, Promise.all race fix, external calendar cancellation handling, engine wiring

## Active Project

- **Path**: /Users/aiassistant/products/noshowzero-landing
- **Stack**: Next.js 15 + Supabase + Twilio WhatsApp + Claude AI
- **Branch**: `main`
- **Build status**: PASSING (76 pages, zero errors)
- **Production**: https://noshowzero-landing.vercel.app
- **Git remote**: https://github.com/mognefullmogne/noshowzero-landing.git
- **Vercel plan**: Pro (upgraded for cron frequency)

## What Was Done This Session

### P0 — DELETE Race Condition Fixed
- **Removed DELETE handler** from `src/app/api/appointments/[id]/route.ts`
  - DELETE now returns 405 with message to use PATCH → cancelled
  - The old DELETE had a race: `triggerBackfill` fire-and-forget, then row deleted before backfill could read appointment data
- **Removed "Elimina Definitivamente" button** from `src/components/appointments/appointment-detail.tsx`
  - All appointment removals now go through Cancel (PATCH → cancelled) which correctly triggers backfill + AI engine

### P1 — Promise.all Race Condition Fixed
- **`src/app/api/optimization/run/route.ts`**: Changed `Promise.all([runOptimization, flagHighRisk])` to sequential execution
- **`src/app/api/cron/run-optimization/route.ts`**: Changed `Promise.all([runOptimization, flagHighRisk, prequalify])` to sequential execution
- Reason: `runOptimization` deletes old proposals, then `flagHighRisk` re-inserts — running in parallel caused duplicates

### External Calendar Cancellation → AI Backfill
- **`src/lib/integrations/appointment-importer.ts`**: When calendar sync receives a cancelled event:
  1. Finds existing appointment by `external_id`
  2. Cancels it (status → cancelled)
  3. Triggers backfill cascade so AI fills the freed slot
  - Previously, cancelled events were simply skipped

### Engine Wiring After Sync
- **`src/lib/integrations/sync-engine.ts`**: After successful import, calls `maybeProcessPending()` so the AI engine evaluates new/cancelled appointments immediately

## Autonomous Flow — Complete Pipeline

Every appointment mutation now awakens the AI:

| Trigger | Path | AI Actions |
|---------|------|------------|
| **Dashboard create** | POST /api/appointments → risk score + reminders + confirmation workflow + `maybeProcessPending` | Confirmation messages, escalation ladder |
| **Dashboard cancel** | PATCH /api/appointments/[id] → status=cancelled → `triggerBackfill` + `maybeProcessPending` | Backfill cascade → offer → WhatsApp |
| **Dashboard status change** | PATCH /api/appointments/[id] → `maybeProcessPending` | Engine processes all pending work |
| **WhatsApp cancel** | Twilio webhook → message-router → `triggerBackfill` + `maybeProcessPending` | Same backfill + smart rebook |
| **WhatsApp accept offer** | Twilio webhook → `processAccept` → new appointment created | Slot filled |
| **WhatsApp decline offer** | Twilio webhook → `processDecline` → `triggerBackfill` (cascade to next) | Next candidate contacted |
| **Calendar sync new** | sync-calendars cron → `importCalendarEvents` → `maybeProcessPending` | Risk scoring, confirmation workflow, engine |
| **Calendar sync cancel** | sync-calendars cron → `handleExternalCancellation` → `triggerBackfill` | Backfill cascade for freed slot |
| **No-show detected** | detect-no-shows cron → status=no_show → `triggerBackfill` | Backfill cascade |
| **Confirmation timeout** | Engine `checkTimeouts` → status=timeout → `triggerBackfill` | Cascade |
| **Offer expired** | expire-offers cron → `triggerBackfill` (cascade to next) | Next candidate contacted |

## What Is In Progress

**Nothing in progress** — all changes are complete, build passes, ready to commit + push.

## What To Do Next

### P0 — Test Full Autonomous Flow
1. Cancel a FUTURE morning appointment for Marco Stylist (Taglio Uomo)
2. Verify Aimone Pitacco (+393516761840) receives WhatsApp offer
3. Reply "sì" → verify appointment created automatically
4. Reply "no" → verify cascade to next candidate
5. Check Vercel logs and DB for audit trail
6. Note: Twilio sandbox only works with pre-joined numbers

### P2 — Twilio Production Number
- Regulatory bundle pending: `BU5ba25bbf9f13d345559d217d15d9e340`
- WhatsApp Business registration + Italian message templates

### P3 — E2E Testing
- Test full flow: cancel → backfill → offer → accept → appointment created

### P3 — Calendar Sync: Handle Modified Events
- Currently only handles new + cancelled events from external calendars
- Modified events (time change, details update) are not synced back — would need to detect changes to existing `external_id` and update appointment

## Key Decisions Made

- **DELETE endpoint disabled** (returns 405) — all removals go through PATCH → cancelled for correct backfill
- **Sequential optimization** — `runOptimization` must complete before `flagHighRiskAppointments` to prevent proposal duplicates
- **External cancellations trigger backfill** — calendar is the source of truth for external changes
- **Engine wired to sync** — `maybeProcessPending` called after every import with new data
- **Vercel Pro** chosen over Upstash QStash for cron frequency (simpler, $20/month)
- **AI Rerank timeout at 3s** is acceptable — math ranking fallback is solid
- **Auto-execute threshold at 90** only applies to manual optimization, not to backfill cascade

## Known Issues & Gotchas

- Twilio WhatsApp sandbox: only pre-joined numbers work
- `smart_score` is null on waitlist entries → scoring defaults to 13/25
- `[AI Rerank] Request timed out after 3000 ms` — Claude Haiku cold start exceeds 3s timeout. Fallback is safe (math ranking). Just log noise.
- The optimization_decisions system and waitlist_offers cascade are independent pipelines
- Calendar sync for modified events not yet implemented (new + cancelled only)

## Files Changed (This Session)

**P0 — DELETE race fix:**
- `src/app/api/appointments/[id]/route.ts` — DELETE handler → 405, removed backfill race
- `src/components/appointments/appointment-detail.tsx` — removed "Elimina Definitivamente" button

**P1 — Promise.all race fix:**
- `src/app/api/optimization/run/route.ts` — Promise.all → sequential
- `src/app/api/cron/run-optimization/route.ts` — Promise.all → sequential

**Full autonomy — external calendar events:**
- `src/lib/integrations/appointment-importer.ts` — cancelled events → cancel appointment + triggerBackfill
- `src/lib/integrations/sync-engine.ts` — maybeProcessPending after successful import

## Test Data

- Patient **Aimone Pitacco** (10ca6f7f-6679-4b9d-bd90-97ff875687c6) — phone +393516761840, WhatsApp channel
- Waitlist entry (b9c9d955) — Taglio Uomo, Marco Stylist, urgency=high, morning, status=waiting
- Tenant ID: `e1d14300-10cb-42d0-9e9d-eb8fee866570`

## Environment

- `.env.local` has all vars (Supabase, Stripe, Twilio, Anthropic)
- `CRON_SECRET` is set in Vercel Production env vars
- Supabase project: `hwxebnmrgrdzpfappyvk`
- Twilio sandbox: `whatsapp:+14155238886`

## How to Verify

```bash
npm run build          # Should pass, 76 pages
git status             # 7 files changed (including HANDOFF.md)
npx vercel logs ...    # Check cron execution in Vercel dashboard
```

## cmux Boss Workflow

### Worker Panes
| Role | Surface | Scope |
|------|---------|-------|
| INVESTIGATOR | surface:14 | Read-only code analysis |
| FRONTEND | surface:15 | src/components/, src/app/(app)/ pages, hooks |
| BACKEND | surface:16 | src/app/api/, src/lib/ (non-AI) |
| AI ENGINE | surface:17 | src/lib/ai/, backfill/, intelligence/, optimization/, scoring/ |
| QA | surface:18 | Build checks, verification only |
