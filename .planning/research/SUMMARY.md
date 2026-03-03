# Project Research Summary

**Project:** NoShowZero — Real-Time Dashboard Milestone
**Domain:** Medical appointment management SaaS — Supabase Realtime integration + production DB migration
**Researched:** 2026-03-03
**Confidence:** HIGH

## Executive Summary

NoShowZero is an existing Next.js 16 (App Router) + Supabase + Vercel SaaS application for small medical clinics. This milestone is a targeted upgrade: replace the current 30-second client-side polling with Supabase Realtime (Postgres Changes over WebSocket), apply 8 pending production DB migrations safely, and add notification UX so clinic staff see appointment confirmations from WhatsApp/SMS in real-time. The full end-to-end flow is well-understood: Twilio webhook fires → serverless API route writes to DB → PostgreSQL WAL triggers Supabase Realtime → WebSocket delivers event to browser → React state updates in under 2 seconds. No new infrastructure is required beyond toggling a Supabase Dashboard setting and running `supabase db push`.

The recommended approach is minimal and additive: one new custom hook (`useRealtimeAppointments`), one new library (`sonner` for toasts), and two SQL statements to enable table replication. The existing `@supabase/supabase-js` (v2.98.0) and `@supabase/ssr` clients already support Realtime without changes. State management stays as pure `useState` delta-merge — no React Query or Zustand needed at this clinic scale (2-5 concurrent staff, <100 appointments/day). The current polling intervals must be removed once Realtime is live to avoid duplicate state update paths.

The two highest risks are the production database migration and multi-tenant data security. Migrations 004–011 touch live patient data and must be preceded by a manual backup (Supabase PITR or `pg_dump`). Every new table in those migrations must have RLS enabled AND a `SELECT` policy defined in the same migration file — RLS without policies silently blocks all queries. For Realtime, the defense-in-depth rule is: always set both the explicit `filter: 'tenant_id=eq.${tenantId}'` on the subscription AND rely on RLS, never one alone. A single misconfigured RLS policy on a Realtime subscription is a cross-tenant patient data leak.

---

## Key Findings

### Recommended Stack

The existing stack is already correct and complete. Only `sonner` (v2.0.7, toast library) needs to be added — everything else is already installed. Supabase Realtime is bundled inside `@supabase/supabase-js` at no extra cost or configuration; Pusher, Ably, custom WebSocket servers, and SSE are all wrong choices on a Vercel serverless deployment. The existing `createBrowserClient` from `@supabase/ssr` (the correct non-deprecated pattern) works with Realtime out of the box.

**Core technologies:**
- `@supabase/supabase-js` ^2.98.0: Realtime WebSocket client — already installed, zero changes needed
- `@supabase/ssr` ^0.9.0: Browser + server client factory (correct current pattern, not deprecated auth-helpers) — already installed
- `next` 16.1.6 + `react` 19.2.3: App Router framework with `useOptimistic` support — already installed
- `sonner` v2.0.7: Toast notifications — only new runtime dependency for this milestone
- Web Audio API / `new Audio()`: Sound alerts — native browser, zero dependencies
- Web Notifications API: Out-of-tab browser alerts — native browser, zero dependencies
- `supabase` CLI: Migration tool for `db push` — `supabase db push --db-url <direct-connection>`

**Critical version note:** `supabase-js` v2.44.0+ is required for channel-level Realtime authorization. The project's ^2.98.0 satisfies this requirement.

### Expected Features

Research identifies a clear tiered hierarchy for this milestone.

**Must have (table stakes):**
- Appointment status updates without page refresh — core value prop, instant sync via Supabase Postgres Changes on `appointments` table
- Color-coded status in calendar view with in-place update (no full re-render flicker)
- Visual connection status indicator — persistent "Live / Reconnecting / Offline" indicator in header (not a toast)
- In-app toast notification on `confirmed` status arrival — top-right, 4-5s auto-dismiss, stacks max 3
- Reconnection with exponential backoff (500ms → 30s max) after `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`
- Stale data recovery on reconnect — REST re-fetch current appointment list, do not replay missed events

**Should have (differentiators, ship if time allows):**
- Optimistic UI for staff-initiated status changes — using React 19 `useOptimistic`, rollback on error
- Audible chime on confirmation arrival — opt-in toggle stored in localStorage, browser Audio API
- Multi-tenant subscription scoping — explicit `filter: 'tenant_id=eq.${tenantId}'` + RLS double-layer

**Defer (v2+ / next milestone):**
- Browser tab badge count — requires PWA manifest scaffolding, Safari support incomplete
- Presence indicators ("who else is viewing") — separate Supabase Realtime Presence channel, high complexity
- WhatsApp source badge — depends on migrations 004-011 `message_events` table being accessible
- Browser push notifications (OS-level) — Service Worker overhead not justified for desk-based clinic staff

**Anti-features (explicitly do not build):**
- Collaborative locks / pessimistic locking — overkill for 2-5 staff, atomic status enum resolves conflicts
- CRDT / operational transform — last-write-wins via Supabase DB is sufficient for appointment status
- Offline write queue — too risky for medical data; show offline state, block mutations, rehydrate on reconnect

### Architecture Approach

The architecture is browser-centric: all Realtime WebSocket connections live exclusively in the browser (`"use client"` components). Vercel serverless functions are stateless HTTP handlers only — they write to the database and return. Supabase's cloud infrastructure maintains the WebSocket server, which then pushes change events to authenticated browser clients. The correct pattern is per-feature custom hooks (not a global context provider), because global provider at `(app)/layout.tsx` would subscribe on Settings/Billing/Docs pages unnecessarily.

**Major components:**
1. `useRealtimeAppointments(tenantId)` hook — single hook at `src/hooks/use-realtime-appointments.ts` that owns the Supabase channel, initial REST fetch, delta state merge, lastEvent for toast triggers, and cleanup on unmount
2. `OperationalDashboard` + `AppointmentsPage` — existing "use client" consumers; replace `setInterval` polling with the new hook
3. Toast/Notification layer — `sonner` `<Toaster />` in root layout; `toast.success()` triggered from hook's `lastEvent`
4. Connection status indicator — persistent UI element reading channel subscription status (`SUBSCRIBED` / reconnecting / offline)
5. Supabase Realtime service (external) — receives PostgreSQL WAL events, evaluates RLS, pushes to authorized clients

**Build order (strict dependency chain):**
1. Enable `supabase_realtime` publication for `appointments` table (Dashboard config, zero code)
2. Verify/audit RLS SELECT policies on all target tables
3. Apply migrations 004-011 via `supabase db push` (with backup)
4. Implement `useRealtimeAppointments` hook
5. Wire hook into `OperationalDashboard` and `AppointmentsPage` (remove polling)
6. Add toast notification layer with Sonner
7. Add optional sound notification

### Critical Pitfalls

1. **Running migrations without backup** — Migrations 004-011 touch live patient data. Take a `pg_dump` snapshot OR enable Supabase PITR (Pro tier required) before any `supabase db push`. Review every file for `DROP`, `TRUNCATE`, `ALTER COLUMN TYPE` before running. Never run on production without staging validation.

2. **RLS without SELECT policies silently blocks Realtime** — When RLS is enabled but no SELECT policy exists, Realtime receives zero events with no error. Channel shows `SUBSCRIBED` but nothing arrives. Every table that gets Realtime enabled needs a SELECT policy in the same migration file, not a separate one.

3. **Multi-tenant Realtime data leak** — If RLS policy `USING` clause is incorrect or absent, all tenants' appointment events stream to every connected client. Always set both RLS policies AND `filter: 'tenant_id=eq.${tenantId}'` on every subscription. Test explicitly with two tenant sessions.

4. **Missing `supabase.removeChannel(channel)` cleanup** — Without this in `useEffect` return, channels accumulate on route changes and React Strict Mode double-mount. Results in duplicate toast notifications and memory growth over multi-hour clinic sessions. This is mandatory, not optional.

5. **Race condition between initial fetch and subscription start** — Changes that arrive between the REST fetch completing and `SUBSCRIBED` status being confirmed are silently missed. Mitigation: subscribe first, await `SUBSCRIBED`, then fetch initial state. Or use TanStack Query `invalidateQueries` on Realtime events to re-fetch rather than applying stale deltas.

---

## Implications for Roadmap

Based on research, the milestone breaks into 3 phases with clear dependency ordering.

### Phase 1: Infrastructure Prerequisites
**Rationale:** Nothing else can proceed until the database is in the correct state. Migrations must be applied before any new tables exist to subscribe to. This phase has no code changes — pure infrastructure.
**Delivers:** Production DB synchronized with all 11 migrations; `appointments` table added to `supabase_realtime` publication; RLS SELECT policies verified on all target tables; `REPLICA IDENTITY FULL` set on appointments
**Addresses:** Migration safety (Pitfall 1), RLS policy gap (Pitfall 3), table not in publication (Pitfall 4), RLS policy ordering (Pitfall 13)
**Actions:**
- Manual backup (`pg_dump`) before any migration
- Run `supabase db push --db-url <direct-connection-string>`
- Run `ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;` via SQL editor
- Audit all migration files for RLS enable + policy in same file
- Verify in Dashboard > Database > Publications

### Phase 2: Core Realtime Implementation
**Rationale:** With DB infrastructure ready, implement the single hook that drives all Realtime behavior. This is the critical path — everything else is built on top of it. Remove polling after hook is wired in to avoid duplicate state update paths.
**Delivers:** `useRealtimeAppointments` hook; polling replaced in `OperationalDashboard` and `AppointmentsPage`; connection status indicator; Sonner toast on confirmation events
**Uses:** Existing `@supabase/supabase-js`, `@supabase/ssr`, `sonner` (new), Web Audio API
**Implements:** Custom hook pattern, immutable delta merge state pattern, mandatory `removeChannel` cleanup
**Addresses:** Memory leak (Pitfall 6), strict mode double-subscribe (Pitfall 7), race condition on init (Pitfall 8), session expiry (Pitfall 12)
**Must avoid:** Subscription in API routes (Pitfall 9), `service_role` key client-side (Pitfall 2)

### Phase 3: Resilience and Polish
**Rationale:** After core Realtime works, add robustness features for real-world clinic use (network drops, overnight sessions, non-WebSocket-friendly hospital networks). Then add optional differentiators.
**Delivers:** Exponential backoff reconnection; stale data recovery on reconnect; WebSocket fallback indicator + polling fallback when disconnected; optimistic UI for staff status changes; optional audible chime
**Uses:** React 19 `useOptimistic`, `document.visibilityState`, `supabase.realtime.connectionState`
**Addresses:** No long-polling fallback (Pitfall 10), free tier limits (Pitfall 14), overnight session expiry (Pitfall 12)
**Defers:** Browser tab badge, presence indicators, WhatsApp source badge

### Phase Ordering Rationale

- Phase 1 is a hard prerequisite: Realtime subscriptions require the table to be in the publication; subscriptions on tables without RLS SELECT policies return zero events silently. Running migrations first eliminates two categories of silent failures before a single line of code is written.
- Phase 2 is the critical path single hook: once `useRealtimeAppointments` works correctly, both dashboard consumers (`OperationalDashboard` and `AppointmentsPage`) can be migrated simultaneously. Toast notifications are trivially added on top of the hook's `lastEvent` output.
- Phase 3 is additive polish: the app works correctly after Phase 2. Phase 3 makes it robust under adverse network conditions and adds the differentiator features that clinic staff will notice (sound, optimistic UI).

### Research Flags

Phases needing careful validation during implementation:
- **Phase 1 (migrations):** Each of the 8 migration files (004-011) must be individually reviewed for destructive SQL and missing RLS policies before being run. Not a standard checklist — requires careful inspection.
- **Phase 2 (race condition mitigation):** The subscribe-first-then-fetch pattern requires correct ordering of async operations. The alternative (TanStack Query invalidation) is cleaner but adds a dependency. This tradeoff needs a decision during implementation.

Phases with well-documented standard patterns (no additional research needed):
- **Phase 2 (hook implementation):** Official Supabase Next.js patterns are documented and the codebase already uses the correct client setup.
- **Phase 3 (reconnection / exponential backoff):** Supabase Realtime client handles reconnection automatically; only the UI indicator and polling fallback require custom code.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core packages already installed and confirmed. Sonner recommended by shadcn/ui officially. Supabase Realtime included in existing subscription — no new vendor. |
| Features | HIGH | Supabase channel states, reconnect strategy, toast UX patterns verified against official docs and multiple authoritative sources. |
| Architecture | HIGH | Custom hook pattern verified against official Supabase Next.js guide. Server/client split is unambiguous (WebSockets browser-only). All dashboard pages already "use client". |
| Pitfalls | HIGH | Migration risk, RLS-blocks-Realtime, and multi-tenant leak are all documented in official Supabase guides with confirmed reproduction paths. |

**Overall confidence:** HIGH

### Gaps to Address

- **Migration file contents (004-011):** Research documents the risk categories but cannot inspect the actual SQL. Each migration file must be manually reviewed during Phase 1 before execution. Specifically check for `DROP TABLE`, `TRUNCATE`, `ALTER COLUMN TYPE`, and RLS-enabled-without-policy patterns.
- **Race condition strategy choice:** Two valid options exist — subscribe-first-then-fetch vs. TanStack Query invalidation. The subscribe-first approach avoids adding a dependency but requires careful async ordering. Decide during Phase 2 implementation based on team preference.
- **REPLICA IDENTITY FULL behavior with RLS:** When both are set, `old_record` only contains primary keys. For DELETE events, this means the hook can identify which row was deleted (by ID) but cannot display the deleted appointment's details in a toast. Acceptable for this milestone (DELETE is rare; staff see the row disappear). Validate this UX is acceptable before Phase 2 completes.
- **Supabase key migration deadline:** Supabase is migrating to new key naming (`sb_publishable_*` / `sb_secret_*`) with a November 1, 2025 deadline (already passed). Audit whether the project's environment variables have been updated to new key names before any Realtime work begins.

---

## Sources

### Primary (HIGH confidence)
- [Supabase Realtime — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — subscription API, publication setup, REPLICA IDENTITY
- [Supabase Realtime — Authorization](https://supabase.com/docs/guides/realtime/authorization) — RLS requirements, channel-level auth
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — official App Router integration guide
- [Supabase CLI — db push](https://supabase.com/docs/reference/cli/supabase-db-push) — migration strategy
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) — concurrent connections, rate limits
- [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod) — RLS, backup requirements
- [Supabase Realtime Troubleshooting](https://supabase.com/docs/guides/realtime/troubleshooting) — silent failure diagnosis
- [shadcn/ui Sonner integration](https://ui.shadcn.com/docs/components/radix/sonner) — official toast recommendation
- [React useOptimistic — Official Docs](https://react.dev/reference/react/useOptimistic) — optimistic UI
- [MDN — Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API) — browser notifications

### Secondary (MEDIUM confidence)
- [Supabase Realtime Silent Disconnections](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794) — heartbeat and reconnection patterns
- [Carbon Design System — Notification Pattern](https://carbondesignsystem.com/patterns/notification-pattern/) — toast UX best practices
- [Using TanStack Query with Supabase Realtime](https://makerkit.dev/blog/saas/supabase-react-query) — state management integration option
- [supabase/realtime-js Issue #169](https://github.com/supabase/realtime-js/issues/169) — React Strict Mode double-subscribe behavior
- [Realtime race condition discussion](https://github.com/orgs/supabase/discussions/5641) — subscribe-then-fetch pattern

### Tertiary (verify during implementation)
- [Supabase Security Retro 2025](https://supaexplorer.com/dev-notes/supabase-security-2025-whats-new-and-how-to-stay-secure.html) — key migration timeline (verify deadline applicability to this project)
- [Realtime RLS blog post](https://supabase.com/blog/realtime-row-level-security-in-postgresql) — verify against current docs (may be outdated)

---
*Research completed: 2026-03-03*
*Ready for roadmap: yes*
