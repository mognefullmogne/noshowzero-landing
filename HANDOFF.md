# Project Handoff

> Last updated: 2026-03-05
> Session: Full Italian localization + fluid dashboard layout

## Active Project

- **Path**: /Users/aiassistant/products/noshowzero-landing
- **Stack**: Next.js 15 + Supabase + Twilio WhatsApp + Claude AI (Haiku/Sonnet)
- **Branch**: `main`
- **Build status**: PASSING (`npx next build` clean)
- **Production**: https://noshowzero-landing.vercel.app
- **Git remote**: https://github.com/mognefullmogne/noshowzero-landing.git

## What Was Done (2026-03-05)

### Full Italian Localization (commits `3c4cb4e`, `16471ad`)
- Translated all landing page components: hero, final-cta, pricing, FAQ, how-it-works, features-grid, industries, social-proof, testimonials, problem-stats
- Translated navbar, footer, dashboard pages, billing, analytics
- Updated `src/lib/constants.ts` — all user-facing strings now Italian
- Changed `<html lang="it">` in root layout metadata
- Converted currency from dollar ($) to euro sign where applicable
- Login/signup UI translated to Italian

### Fluid Dashboard Layout (commit `3c4cb4e`)
- Removed `max-w-7xl` cap from `src/app/(app)/layout.tsx` so dashboard pages stretch full viewport width
- Calendar table uses `table-fixed` for even column distribution

### Verified Non-Issues (P2 from previous session)
- `/patients` 404 — confirmed this page was never built; not a regression
- `/onboarding` redirect — already redirects to `/dashboard` post-onboarding, working correctly

## What To Do Next (Priority Order)

### P1 — E2E Test Cancel Flow + Backfill Cascade
- Send reminder to Luca Ferrari via WhatsApp
- User replies NO (or Italian equivalent)
- Verify appointment status changes to cancelled
- Verify backfill cascade triggers offers to waitlisted patients
- Backfill cascade code deployed in PR #2 (commit `4833441`) but never tested end-to-end

### P2 — Twilio Production Number
- Purchase Italian Twilio number (regulatory bundle pending: `BU5ba25bbf9f13d345559d217d15d9e340`)
- WhatsApp Business registration + Italian message templates
- Move off sandbox to production messaging

### P3 — Visual Polish for Wide Screens
- With `max-w` cap removed, some pages may benefit from layout adjustments on very wide monitors
- Review dashboard, calendar, appointments pages at 1920px+ widths

## Key Decisions

- App is fully Italian-localized — all UI strings, metadata, currency in Italian/EUR
- Dashboard layout is fluid (no max-width cap) for maximum screen utilization
- Only Luca Ferrari has the real test phone — all other patients have fake numbers to avoid disambiguation
- Phone disambiguation picks nearest future appointment (not arbitrary DB order)

## Known Issues & Gotchas

- Twilio WhatsApp sandbox webhook URL can ONLY be changed via Twilio console UI — no API endpoint exists
- Sandbox "When a message comes in" URL must exactly match `TWILIO_WEBHOOK_URL` env var for signature verification
- Twilio WhatsApp sandbox: only pre-joined numbers work
- Test account: `aimonepitacco@gmail.com` / `Aimone123!`
- Vercel Hobby plan: crons limited to daily frequency only

## Environment & Config

- `.env.local` has all required vars (Supabase, Stripe, Twilio, Anthropic)
- Supabase project: `hwxebnmrgrdzpfappyvk`
- Tenant ID: `e1d14300-10cb-42d0-9e9d-eb8fee866570`
- Test patient: Luca Ferrari, phone `+393516761840`
- Twilio sandbox: `whatsapp:+14155238886`
- Twilio webhook: `https://noshowzero-landing.vercel.app/api/webhooks/twilio`

## How to Verify

```bash
npx next build        # should pass, zero errors
npx vitest run        # unit tests
npm run dev           # http://localhost:3000
```

## Parallel Agent Workflow (cmux + claude instances)

The user prefers splitting work into parallel claude instances via cmux split panes. Here's how:

```bash
# 1. Create a split pane
cmux new-split right    # returns e.g. "OK surface:5 workspace:1"

# 2. Type 'claude' and press Enter to start a claude instance
cmux send --surface surface:5 'claude'
cmux send-key --surface surface:5 Enter

# 3. Wait ~8 seconds for claude to boot, then verify it's ready
sleep 8
cmux read-screen --surface surface:5 --lines 5
# Should show the "❯" prompt with "Opus 4.6 │ noshowzero-landing"

# 4. Send the task prompt, then press Enter
cmux send --surface surface:5 "Your job: [describe task clearly]. When done say DONE."
cmux send-key --surface surface:5 Enter

# 5. Monitor progress periodically
cmux read-screen --surface surface:6 --lines 10

# 6. When agent says DONE, exit and close
cmux send --surface surface:5 '/exit'
cmux send-key --surface surface:5 Enter
sleep 2
cmux close-surface --surface surface:5

# 7. Notify the user and flash
cmux notify --title "Task Complete" --subtitle "Details" --body "Description"
cmux trigger-flash
```

Key notes:
- Always send `claude` first, press Enter, wait for it to boot, THEN send the prompt separately
- Do NOT use `claude -p "prompt"` — it runs non-interactively and may not work properly
- Use `cmux read-screen --surface surface:N --lines 15` to check progress
- Use `cmux read-screen --surface surface:N --lines 50 --scrollback` to see full output history
- Max 3 parallel instances to avoid overwhelming the system
- `cmux send-key` for special keys: `Enter`, `ctrl-c`, etc.
- `cmux trigger-flash` to get user's attention when work is complete
