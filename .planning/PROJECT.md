# NoShowZero — Real-Time Fix & Dashboard Polish

## What This Is

A SaaS appointment management platform that reduces no-shows through automated WhatsApp/SMS confirmations, smart waitlist matching, and AI risk scoring. Used by small medical clinics (2-5 staff) to manage patient appointments, send reminders, and fill cancelled slots from a waitlist. Deployed on Vercel with Supabase as the backend.

## Core Value

When a patient confirms or cancels an appointment via WhatsApp, every staff member sees the change instantly on their dashboard — no refresh, no lag, no stale data.

## Requirements

### Validated

- ✓ WhatsApp/SMS webhook ingestion (Twilio) — existing
- ✓ Appointment CRUD with status management — existing
- ✓ Multi-tenant architecture with RLS — existing
- ✓ Calendar integrations (Google, Outlook, iCal, CSV) — existing
- ✓ Smart waitlist scoring & offer system — existing
- ✓ AI risk scoring (Claude) — existing
- ✓ Stripe billing with multi-tier plans — existing
- ✓ Conversational WhatsApp booking flow — existing
- ✓ Cron-based reminders and confirmations (7 jobs) — existing
- ✓ API key authentication for external integrations — existing

### Active

- [ ] Production database has all 11 migrations applied (004-011 missing)
- [ ] WhatsApp webhook confirmations persist reliably (no silent failures)
- [ ] Dashboard updates in 1-2 seconds when appointment status changes (Supabase Realtime)
- [ ] Calendar view reflects appointment status changes in real-time
- [ ] Toast/sound notifications when confirmations arrive on dashboard
- [ ] Multi-channel sync — WhatsApp, SMS, and email all trigger the same real-time update flow
- [ ] General dashboard UI polish (styling, layout, responsiveness)

### Out of Scope

- Mobile native app — web-first, responsive design sufficient for now
- New feature development (e.g., new booking channels, video appointments) — fix and polish first
- Local development dashboard (localhost:3010) — this project targets the Vercel deployment only
- Migration to a different hosting provider — staying on Vercel + Supabase

## Context

- **Live URL:** https://noshowzero-landing.vercel.app/
- **Tech stack:** Next.js 16 (App Router) + Supabase (PostgreSQL 16) + Twilio + Stripe + Claude AI
- **Current real-time:** 30-second client-side polling (no WebSockets/SSE)
- **Target real-time:** Supabase Realtime (built-in Postgres change notifications over WebSockets)
- **Database issue:** Migrations 004-011 never ran in production. Missing tables: message_threads, message_events, appointment_slots, rulesets, optimization_decisions, audit_events, confirmation_workflows, kpi_snapshots, booking_sessions, calendar_integrations, import_logs. The previous session hit a DB password issue with the Supabase pooler — user will provide the correct connection string from Supabase Dashboard.
- **Codebase size:** ~26,700 lines TypeScript/TSX across 80+ files
- **Users:** Small team of 2-5 clinic staff
- **Production data:** 1 patient (stefano rossi), 1 appointment (esame prostata, 06/03/2026)

## Constraints

- **Hosting:** Vercel (serverless functions, no persistent WebSocket server) — Supabase Realtime handles the WS connection client-side
- **Database:** Supabase (must use their connection pooler for serverless; Realtime is built-in)
- **Budget:** Supabase free/pro tier — Realtime included at no extra cost
- **Backwards compatibility:** Must not break existing WhatsApp webhook flow, cron jobs, or Stripe billing
- **Multi-tenant:** All real-time subscriptions must be scoped to the authenticated tenant

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Realtime over Pusher/Ably/custom WS | Already on Supabase, zero additional infrastructure, free tier includes Realtime | — Pending |
| Fix production DB before adding real-time | Can't subscribe to tables that don't exist; also fixes the data inconsistency root cause | — Pending |
| Target online deployment only | User explicitly wants fixes on Vercel, not the local dev server | — Pending |

---
*Last updated: 2026-03-03 after initialization*
