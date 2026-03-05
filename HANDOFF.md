# Project Handoff

> Last updated: 2026-03-05
> Session: Neutralize phone number, add cancel button, seed recovery stats

## Active Project

- **Path**: /Users/aiassistant/products/noshowzero-landing
- **Stack**: Next.js 15 + Supabase + Twilio WhatsApp + Claude AI (Haiku/Sonnet)
- **Branch**: `main`
- **Build status**: PASSING (`npx next build` clean)
- **Production**: https://noshowzero-landing.vercel.app
- **Git remote**: https://github.com/mognefullmogne/noshowzero-landing.git

## What Was Done (2026-03-05, Session 4)

### Phone Number Neutralized
- **Problem**: User received 3 WhatsApp messages for appointments because `DEMO_PHONE_OVERRIDE` in `send-notification.ts` hardcoded `+393516761840` and redirected ALL demo tenant messages to it
- **Fix**: `DEMO_PHONE_OVERRIDE` now reads from `process.env.DEMO_PHONE_OVERRIDE` — defaults to `null` (disabled). Set the env var to re-enable.
- **File**: `src/lib/twilio/send-notification.ts`
- Seed script also updated: all 15 test patients now have unique fake phones (`+390000000001` through `+390000000015`) instead of the real number
- **File**: `scripts/seed-hairdresser.mjs`

### Cancel Button on Appointments Table + Calendar
- **Appointments table** (`src/components/appointments/appointments-table.tsx`): Added X button per row (hidden for cancelled/completed/no_show). Calls `PATCH /api/appointments/{id}` with `{status: "cancelled"}`. Italian confirmation dialog ("Sei sicuro?"). Triggers backfill automatically.
- **Calendar view** (`src/app/(app)/calendar/page.tsx`): Added subtle X button on each appointment card. Same cancel + backfill behavior.
- Both use `e.stopPropagation()` to avoid opening detail dialog when clicking cancel.

### Database Re-seeded (Production)
- Cleaned all existing tenant data (FK-safe order) from production Supabase
- Re-seeded: 15 patients, 800 slots, 78 appointments across 4 weeks
- Created 4 accepted `waitlist_offers` (with `new_appointment_id` pointing to completed appointments) — populates "Slot recuperati" and "Ricavi salvati"
- Created 2 pending `waitlist_offers` — populates "Offerte attive"
- Response times seeded at 5-30 min — "Tempo medio risposta" shows real numbers
- Also created matching `waitlist_entries` (required FK for offers)

## What Was Done (2026-03-05, Sessions 2-3) — History

- Fixed cancel flow: `"confirmed"` added to actionable statuses
- Smart rebooking: rewritten to use calendar gaps, returns text (no fire-and-forget)
- `handleCancel` now awaits rebook and returns single combined TwiML message
- New `reschedule` intent with Italian regex patterns
- Waitlist via WhatsApp (`join_waitlist` intent, LISTA keyword)
- Markdown rendering: `renderInlineMarkdown()` + `MarkdownBlock`
- Created `/cmux-delegate` skill for parallel agent workflow

## What Is In Progress

### NOT YET COMMITTED — 13 files modified
- All changes from sessions 3 + 4 are uncommitted
- Must commit, push to main, and Vercel will auto-deploy

## What To Do Next (Priority Order)

### P0 — Commit, Push, Deploy
- Commit all 13 modified files
- Push to main → Vercel auto-deploys
- Verify dashboard shows recovery stats on production

### P1 — Test Cancel + Rebook + Reschedule Flow
- Go to Appointments or Calendar on production site
- Click X to cancel an appointment → verify backfill triggers
- Check dashboard stats update (slot recuperati should increment)
- Test WhatsApp flow if needed (reminder → cancel → rebook)

### P2 — Waitlist Contact When Slot Opens
- Connect `waitlist_entries` (from LISTA responses) to backfill cascade
- When a patient cancels, check waitlist for matching patients

### P3 — Twilio Production Number
- Regulatory bundle pending: `BU5ba25bbf9f13d345559d217d15d9e340`
- WhatsApp Business registration + Italian message templates

## Key Decisions

- App is fully Italian-localized — all UI strings, metadata, currency in Italian/EUR
- Dashboard layout is fluid (no max-width cap)
- `DEMO_PHONE_OVERRIDE` disabled by default — set env var to re-enable for testing
- All test patients have fake phone numbers — no real phones in seed data
- Calendar gap-based slot finding for rebooking (not dependent on `appointment_slots` table)
- Rebooking uses `slot_proposals` table so patient can respond with 1/2/3
- Cancel reply is a single combined message (cancel + rebook options)
- `smart-rebook.ts` is a pure function: creates DB proposal, returns text, does NOT send messages
- User prefers parallel cmux agent delegation for complex tasks (skill: `/cmux-delegate`)

## Known Issues & Gotchas

- Twilio WhatsApp sandbox webhook URL can ONLY be changed via Twilio console UI
- Twilio WhatsApp sandbox: only pre-joined numbers work
- Test account: `aimonepitacco@gmail.com` / `Aimone123!`
- Vercel Hobby plan: crons limited to daily frequency only
- Calendar gap finder uses server timezone — may need timezone-aware logic later
- `clode` command does not exist — use `claude` when spawning instances via cmux
- Seed script `waitlist_offers` uses `waitlist_entry_id: null` — OK since migration 012 made it nullable

## Files Changed (Session 4)

**Phone number fix**:
- `src/lib/twilio/send-notification.ts` — DEMO_PHONE_OVERRIDE now env-var based
- `scripts/seed-hairdresser.mjs` — fake phones, recovery data seeding

**Cancel button**:
- `src/components/appointments/appointments-table.tsx` — X button per row
- `src/app/(app)/calendar/page.tsx` — X button on calendar appointment cards

**From Session 3 (still uncommitted)**:
- `src/lib/ai/smart-rebook.ts` — removed sendMessage, returns text
- `src/lib/webhooks/message-router.ts` — handleCancel awaits rebook, new handleReschedule
- `src/lib/messaging/intent-engine.ts` — added reschedule regex
- `src/lib/types.ts` — added "reschedule" to MessageIntent
- `src/app/api/webhooks/twilio/route.ts` — added "reschedule" to VALID_INTENTS

## Environment & Config

- `.env.local` has all required vars (Supabase, Stripe, Twilio, Anthropic)
- Supabase project: `hwxebnmrgrdzpfappyvk`
- Tenant ID: `e1d14300-10cb-42d0-9e9d-eb8fee866570`
- Twilio sandbox: `whatsapp:+14155238886`
- Twilio webhook: `https://noshowzero-landing.vercel.app/api/webhooks/twilio`
- `DEMO_PHONE_OVERRIDE` env var: unset (disabled) — set to a phone number to re-enable

## How to Verify

```bash
npx next build        # should pass, zero errors
npx vitest run        # unit tests
npm run dev           # http://localhost:3000
vercel logs --follow  # check function logs after deploy
```

## Parallel Agent Workflow (cmux + claude instances)

The user prefers splitting work into parallel claude instances via cmux split panes. Skill: `/cmux-delegate`.

```bash
cmux new-split right           # create pane
cmux send --surface surface:N 'claude'
cmux send-key --surface surface:N Enter
sleep 10                        # wait for boot
cmux send --surface surface:N "Your task. When done say DONE."
cmux send-key --surface surface:N Enter
cmux read-screen --surface surface:N --lines 50 --scrollback  # monitor
```

Max 3 parallel instances. After all complete, verify build + resolve conflicts.
