# Project Handoff — NoShowZero

> Last updated: 2026-03-05
> Session: 7 bug fixes + optimization flow complete

## Active Project

- **Path**: /Users/aiassistant/products/noshowzero-landing
- **Stack**: Next.js 15 + Supabase + Twilio WhatsApp + Claude AI
- **Branch**: `main`
- **Build status**: PASSING
- **Production**: https://noshowzero-landing.vercel.app
- **Git remote**: https://github.com/mognefullmogne/noshowzero-landing.git

## Current State (Everything Deployed)

All code is committed and deployed. No pending changes.

### 7 Bug Fixes (commit `4ab9ed2`)
1. **Date filter** — Fixed timezone parsing + API date query param
2. **Optimization Run Analysis** — Added error handling, loading state, proper API response
3. **Audit section** — `logAuditEvent` wired into appointment CRUD, offer sending, optimization
4. **Strategy log** — Entry creation added to decision engine + RLS fix on no-show analysis
5. **Dashboard widgets** — No-show insights + strategy log now fetch data correctly
6. **Delete button** — Shows on ALL appointments regardless of status
7. **Backfill pipeline** — Past-slot guard uses slot end time (no-shows can now trigger backfill)

### Optimization Flow (commit `47e0f2e`)
- **Approve** → creates appointment (in calendar) + marks slot booked + waitlist entry fulfilled + audit log
- **Reject** → marks decision rejected
- **Auto-execute** for score ≥ 90 (no human approval needed)
- Optimistic UI: card disappears instantly, toast notification via sonner
- Scoring: service match (30) + smart score (25) + time pref (20) + urgency (15) + payment (10) + provider bonus (5) = max 100

### Test Data in DB
- 3 deleted appointments to create gaps (Luca Ferrari, Sofia Russo, Davide Conti)
- 3 waitlist entries added (Marco Rossi, Giulia Bianchi, Luca Ferrari — status: waiting/fulfilled)
- 3 optimization decisions created (scores 80-85, status: proposed/executed)

## Key Decisions

- App is fully Italian-localized (UI, currency EUR, dates it-IT)
- `DEMO_PHONE_OVERRIDE` disabled by default — set env var to re-enable
- Optimization threshold: score ≥ 90 = auto-approve, < 90 = human review
- Backfill allows past-start slots if slot end time hasn't passed yet

## Environment

- `.env.local` has all vars (Supabase, Stripe, Twilio, Anthropic)
- Tenant ID: `e1d14300-10cb-42d0-9e9d-eb8fee866570`
- Supabase project: `hwxebnmrgrdzpfappyvk`
- Twilio sandbox: `whatsapp:+14155238886`
- Twilio webhook: `https://noshowzero-landing.vercel.app/api/webhooks/twilio`

## Known Issues

- Twilio WhatsApp sandbox: only pre-joined numbers work, webhook URL changed via console only
- Vercel Hobby plan: crons limited to daily frequency
- Audit table populates only as users take actions (no historical data)
- `smart_score` is null on waitlist entries → scoring defaults to 13/25

## What To Do Next

### P1 — Twilio Production Number
- Regulatory bundle pending: `BU5ba25bbf9f13d345559d217d15d9e340`
- WhatsApp Business registration + Italian message templates

### P2 — Cron Jobs
- Set up Vercel crons for: detect-no-shows, run-optimization, send-confirmations, process-reminders
- These populate audit, strategy log, and trigger backfill automatically

### P3 — E2E Testing
- Test full flow: cancel appointment → backfill triggers → waitlist candidate gets offer → accepts → new appointment in calendar

## cmux Boss Workflow

### RULES
- **Boss instance does NOT write code. Only delegates via cmux prompts.**
- **Do NOT sleep/wait for workers.** User says when worker is done, then boss reads output.
- After QA passes: `git add -A && git commit -m "fix: desc" && git push origin main`
- Use `cmux notify` + `cmux trigger-flash` when a round completes.

### How to Send Prompts
1. If claude not running in pane: `cmux send --surface surface:N 'claude'` + Enter, wait for user confirmation
2. If claude already running: `cmux send --surface surface:N 'prompt here'` + Enter
3. Read output: `cmux read-screen --surface surface:N --lines 100 --scrollback`

### Worker Panes
| Role | Surface | Scope |
|------|---------|-------|
| INVESTIGATOR 🔍 | surface:14 | Read-only code analysis |
| FRONTEND 🎨 | surface:15 | src/components/, src/app/(app)/ pages, hooks, contexts |
| BACKEND ⚙️ | surface:16 | src/app/api/, src/lib/ (non-AI) |
| AI ENGINE 🧠 | surface:17 | src/lib/ai/, backfill/, intelligence/, optimization/, scoring/ |
| QA ✅ | surface:18 | Build checks, verification only |
