# NoShowZero

## What This Is

A SaaS appointment management platform that reduces no-shows through automated WhatsApp confirmations, AI-driven slot recovery, and smart patient prioritization. When a patient cancels, the system automatically finds the best replacement from all scheduled patients and offers them the slot via WhatsApp — one by one, ranked by AI priority. Used by appointment-based businesses (clinics, salons, dental practices) to recover lost revenue. Deployed on Vercel with Supabase as the backend.

## Core Value

When a patient cancels or no-shows, the system automatically fills that slot by contacting the best-fit patient via WhatsApp — no staff intervention, no empty chairs, no lost revenue.

## Current Milestone: v1.1 Slot Recovery Engine

**Goal:** Make the core business logic actually work end-to-end — when a patient cancels, the AI automatically finds and contacts replacement candidates one-by-one until the slot is filled.

**Target features:**
- Auto-candidate detection from all scheduled patients when a slot opens
- AI priority scoring (clinical urgency, wait time, proximity, reliability)
- One-by-one WhatsApp cascade with 1-hour timeout per offer
- Real revenue metrics (only count actually recovered slots + saved no-shows)
- Configurable average appointment value per tenant
- Dashboard KPIs: slots recovered, revenue recovered, fill rate %, active offers

## Requirements

### Validated

- ✓ WhatsApp/SMS webhook ingestion (Twilio) — v1.0
- ✓ Appointment CRUD with status management — v1.0
- ✓ Multi-tenant architecture with RLS — v1.0
- ✓ Calendar integrations (Google, Outlook, iCal, CSV) — v1.0
- ✓ AI risk scoring (Claude) — v1.0
- ✓ Stripe billing with multi-tier plans — v1.0
- ✓ Conversational WhatsApp booking flow — v1.0
- ✓ Cron-based reminders and confirmations — v1.0
- ✓ API key authentication for external integrations — v1.0
- ✓ Supabase Realtime WebSocket subscriptions — v1.0
- ✓ Live dashboard/calendar updates within 2 seconds — v1.0
- ✓ Connection status indicator with auto-reconnect — v1.0
- ✓ Tenant-scoped real-time security — v1.0

### Active

- [ ] Auto-candidate detection when a slot opens (cancellation/no-show)
- [ ] AI priority ranking: clinical urgency, wait time, proximity, reliability
- [ ] One-by-one WhatsApp cascade offers with 1-hour timeout
- [ ] Real revenue metrics: filled slots + saved no-shows only
- [ ] Configurable average appointment value per tenant
- [ ] Dashboard KPIs: slots recovered, revenue recovered, fill rate %, active offers

### Out of Scope

- Manual waitlist entry by staff — system should auto-detect candidates
- SMS/email channel for offers — WhatsApp only for this milestone
- Past patients without scheduled appointments — only consider currently scheduled patients
- Mobile native app — web-first, responsive design sufficient
- Local development dashboard — targets Vercel deployment only

## Context

- **Live URL:** https://noshowzero-landing.vercel.app/
- **Tech stack:** Next.js 15 (App Router) + Supabase (PostgreSQL 16) + Twilio (WhatsApp sandbox) + Stripe + Claude AI
- **Codebase:** ~26,700 lines TypeScript/TSX across 80+ files
- **Backend code exists but isn't connected:** The codebase has waitlist scoring (`waitlist-score.ts`), backfill logic (`trigger-backfill.ts`, `find-candidates.ts`, `send-offer.ts`, `process-response.ts`), and AI risk scoring (`ai-risk-score.ts`). However, the waitlist is empty (no auto-population), revenue metrics are inflated (counting all confirmations, not just recoveries), and the cascade trigger isn't firing on cancellations.
- **Demo tenant ID:** `e1d14300-10cb-42d0-9e9d-eb8fee866570`
- **Test phone:** `+393516761840` (all 19 test patients use this)
- **Twilio:** WhatsApp sandbox mode (`whatsapp:+14155238886`)

## Constraints

- **Hosting:** Vercel serverless — no long-running processes, cron jobs via Vercel Cron
- **Database:** Supabase with connection pooler for serverless
- **WhatsApp sandbox:** Limited to pre-joined numbers; production Twilio requires business verification
- **Single test phone:** All 19 patients share one phone number — cascade testing requires awareness of this
- **Backwards compatibility:** Must not break existing webhook flow, cron jobs, or Stripe billing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Realtime over Pusher/Ably | Already on Supabase, zero additional infra | ✓ Good |
| Auto-detect candidates vs manual waitlist | Staff shouldn't have to maintain a separate list; AI should find best fit from existing patients | — Pending |
| WhatsApp only for offers | Same channel patients already use for confirmations; simplest flow | — Pending |
| 1-hour offer timeout | Balanced — gives patient time to respond but keeps cascade moving | — Pending |
| Only scheduled patients as candidates | Past patients without appointments adds complexity; start with known-scheduled patients | — Pending |
| Configurable appointment value per tenant | Different businesses have different price points; can't hardcode €150 | — Pending |
| Revenue = filled slots + saved no-shows | Honest metric; don't inflate with regular confirmations | — Pending |

---
*Last updated: 2026-03-04 after milestone v1.1 initialization*
