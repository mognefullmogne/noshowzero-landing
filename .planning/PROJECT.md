# NoShowZero

## What This Is

A SaaS appointment management platform that reduces no-shows through automated WhatsApp confirmations, AI-driven slot recovery, and smart patient prioritization. When a patient cancels, the system automatically finds the best replacement from all scheduled patients and offers them the slot via WhatsApp — one by one, ranked by AI priority. Used by appointment-based businesses (clinics, salons, dental practices) to recover lost revenue. Deployed on Vercel with Supabase as the backend.

## Core Value

When a patient cancels or no-shows, the system automatically fills that slot by contacting the best-fit patient via WhatsApp — no staff intervention, no empty chairs, no lost revenue.

## Current Milestone: v1.1 Slot Recovery Engine — COMPLETE

**Goal:** Make the core business logic actually work end-to-end — when a patient cancels, the AI automatically finds and contacts replacement candidates one-by-one until the slot is filled.

**Status:** All v1.1 features are implemented and production-ready.

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
- ✓ Auto-candidate detection on cancellation/no-show — v1.1
- ✓ AI priority ranking: math score + Claude Haiku re-ranking — v1.1
- ✓ One-by-one WhatsApp cascade with time-aware timeout (30min–2h) — v1.1
- ✓ Parallel outreach for urgent slots (<2h to appointment) — v1.1
- ✓ Real revenue metrics: filled slots + saved no-shows only — v1.1
- ✓ Configurable average appointment value per tenant (default €80) — v1.1
- ✓ Dashboard KPIs: slots recovered, revenue recovered, fill rate %, active offers — v1.1
- ✓ AI Decision Engine: strategic cascade reasoning (Sonnet 4.6) — v1.1
- ✓ Pre-emptive cascade: pre-qualify candidates for critical-risk appointments — v1.1
- ✓ 3-touch confirmation escalation: WhatsApp → SMS → final warning — v1.1
- ✓ Patient memory extraction from WhatsApp messages (Haiku) — v1.1
- ✓ Response pattern learning for channel/time optimization — v1.1
- ✓ Morning briefing generator with 1h cache (Sonnet 4.6) — v1.1
- ✓ No-show root cause analysis with 24h cache (Sonnet 4.5) — v1.1
- ✓ Chain cascade: accepting an offer frees original slot → triggers new backfill — v1.1

### Out of Scope

- Manual waitlist entry by staff — system should auto-detect candidates
- SMS/email channel for offers — WhatsApp only for this milestone
- Past patients without scheduled appointments — only consider currently scheduled patients
- Mobile native app — web-first, responsive design sufficient
- Local development dashboard — targets Vercel deployment only

## Context

- **Live URL:** https://noshowzero-landing.vercel.app/
- **Tech stack:** Next.js 15 (App Router) + Supabase (PostgreSQL 16) + Twilio (WhatsApp purchased number) + Stripe + Claude AI (12 use cases)
- **Codebase:** ~43,500 lines TypeScript/TSX across 282 files, 70+ API routes
- **WhatsApp:** Purchased number `whatsapp:+393399957337`, Messaging Service SID `MG2b3b5573ab7a04bf5428a5c563846fe7`, 5 Meta-approved Content Templates
- **Pricing:** Starter €90/mo, Growth €160/mo, Enterprise €499/mo (14-day trial)
- **AI models:** Sonnet 4.6 (strategic reasoning), Sonnet 4.5 (deep analysis), Haiku 4.5 (fast classification/scoring)
- **Cron jobs:** 10 Vercel Cron jobs (confirmations, escalation, expiry, no-show detection, optimization, sync, KPI snapshots)
- **Database:** 19 migrations, RLS multi-tenancy, optimized indexes for candidate lookup
- **Demo tenant ID:** `e1d14300-10cb-42d0-9e9d-eb8fee866570`
- **Test phone:** `+393516761840` (all 19 test patients use this)

## Constraints

- **Hosting:** Vercel serverless — no long-running processes, cron jobs via Vercel Cron
- **Database:** Supabase with connection pooler for serverless
- **WhatsApp Content Templates:** Required for messages outside 24h conversation window; 5 templates approved by Meta
- **Single test phone:** All 19 patients share one phone number — cascade testing requires awareness of this
- **Backwards compatibility:** Must not break existing webhook flow, cron jobs, or Stripe billing
- **In-memory state resets on cold start:** Rate limiting and AI caches (morning briefing 1h, no-show analysis 24h) reset on Vercel cold start

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Realtime over Pusher/Ably | Already on Supabase, zero additional infra | ✓ Good |
| Auto-detect candidates vs manual waitlist | Staff shouldn't have to maintain a separate list; AI finds best fit from existing patients | ✓ Implemented |
| WhatsApp only for offers | Same channel patients already use for confirmations; simplest flow | ✓ Implemented |
| Time-aware offer timeout (30min–2h) | Urgent slots need faster cascade; future slots can wait | ✓ Implemented |
| Only scheduled patients as candidates | Past patients without appointments adds complexity; start with known-scheduled patients | ✓ Implemented |
| Configurable appointment value per tenant | Different businesses have different price points; default €80 | ✓ Implemented |
| Revenue = filled slots + saved no-shows | Honest metric; don't inflate with regular confirmations | ✓ Implemented |
| AI Decision Engine with rule-based fallback | Strategic reasoning for complex situations; deterministic fallback ensures reliability | ✓ Implemented |
| Haiku for fast tasks, Sonnet for reasoning | Cost optimization: Haiku handles 7 use cases (classification, scoring, parsing), Sonnet handles 4 strategic tasks | ✓ Implemented |
| Purchased WhatsApp number over sandbox | Sandbox limited to pre-joined numbers; purchased number reaches all patients | ✓ Migrated |
| Content Templates for all outbound WhatsApp | Required outside 24h window; 5 templates approved by Meta | ✓ Approved |
| Google Calendar OAuth separate from sign-in | Different OAuth clients; Calendar uses app client, sign-in uses Supabase-managed client | ✓ Implemented |

## Known Issues

- **Google Calendar callback crashes** — OAuth flow completes but callback returns `?error=oauth_failed`. Integration row never saved. Needs error logging to diagnose.
- **Unverified Google app warning** — Users must click "Advanced" → "Continue" to proceed past Google consent
- **Outlook integration not configured** — `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` not set
- **Rate limiting is in-memory** — Resets on Vercel cold start (chat: 20 req/60s, Twilio: 10 msg/60s)
- **Google Calendar events have no phone numbers** — Imported patients only have email; WhatsApp reminders won't work unless phone added manually
- **Pre-existing test TS errors** — `IntentResult` missing `source` property in Twilio webhook tests

---
*Last updated: 2026-03-09*
