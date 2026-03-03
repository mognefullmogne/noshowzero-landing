# Roadmap: NoShowZero — Real-Time Fix & Dashboard Polish

## Overview

This milestone upgrades the NoShowZero production deployment from a fragile 30-second polling loop to a robust Supabase Realtime WebSocket subscription. The work follows a strict dependency chain: first synchronize the production database (8 pending migrations), then implement the single custom hook that drives all real-time behavior across the dashboard, then harden the system against real-world network conditions (disconnections, reconnects, stale state). When complete, every clinic staff member sees appointment confirmations from WhatsApp arrive on-screen within 2 seconds — no refresh, no lag.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Infrastructure** - Synchronize production DB and enable Realtime publication prerequisites
- [ ] **Phase 2: Core Realtime** - Implement useRealtimeAppointments hook, replace polling, add toast notifications
- [ ] **Phase 3: Resilience** - Add reconnection logic, stale data recovery, and connection status indicator

## Phase Details

### Phase 1: Infrastructure
**Goal**: Production database is fully synchronized and Realtime-ready — all migrations applied, appointments table in publication, RLS policies verified
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. A pg_dump backup of the production database exists before any migration runs
  2. All 11 migrations (001-011) are present and applied in Supabase Dashboard > Database > Migrations with zero errors
  3. The appointments table appears in Supabase Dashboard > Database > Publications under supabase_realtime
  4. Every table introduced by migrations 004-011 has RLS enabled and at least one SELECT policy visible in Supabase Dashboard > Database > Policies
  5. A WhatsApp webhook test (Twilio webhook simulator or ngrok) successfully updates an appointment status and the change persists in the database
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Extend migration runner (PITR checkpoint, migrations 004-011, Realtime publication) and apply to production
- [ ] 01-02-PLAN.md — Create verification script (table/RLS/publication checks, RLS auto-fix for migration 010, data integrity) and run against production

### Phase 2: Core Realtime
**Goal**: Appointment status changes from any source (WhatsApp, SMS, manual dashboard) appear on every staff browser within 2 seconds without a page refresh
**Depends on**: Phase 1
**Requirements**: RT-01, RT-02, RT-03, RT-06, RT-07, SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. Changing an appointment status (via dashboard or WhatsApp simulation) causes the appointments list to update within 2 seconds with no manual refresh
  2. The operational dashboard KPI cards (today's count, pending confirmations, urgent deadlines) reflect status changes in real-time
  3. The calendar view updates appointment colors and labels in-place when status changes, without a full re-render flicker
  4. A toast notification appears top-right when an appointment is confirmed (auto-dismisses after 4-5 seconds, stacks max 3)
  5. The browser Network tab shows no recurring polling requests to /api/appointments (30-second polling is gone)
  6. Opening the app in two different browser tabs for two different tenants shows each tenant's appointments only — no cross-tenant data leaks
**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md — Create useRealtimeAppointments hook (subscribe-first-then-fetch, delta-merge, channel cleanup)
- [ ] 02-02-PLAN.md — Wire hook into AppointmentsPage, OperationalDashboard, and CalendarPage; remove all polling
- [ ] 02-03-PLAN.md — Install Sonner toast notifications, add confirmation toasts, verify SEC-02

### Phase 3: Resilience
**Goal**: The real-time connection survives network drops, browser tab switches, and overnight clinic sessions — staff always know if they are live or offline
**Depends on**: Phase 2
**Requirements**: RT-04, RT-05
**Success Criteria** (what must be TRUE):
  1. A persistent "Live" indicator is visible in the dashboard header at all times; it changes to "Reconnecting" when the WebSocket drops and returns to "Live" when restored
  2. Simulating a network interruption (browser DevTools > offline for 10s then back online) results in the appointments list refreshing to current state without requiring a page reload
  3. After reconnection, any appointment status changes that occurred during the disconnection are reflected (stale data recovery via REST re-fetch, not event replay)
  4. The connection indicator never shows "Live" when the WebSocket channel is not actually SUBSCRIBED
**Plans**: TBD

Plans:
- [ ] 03-01: Implement reconnection with exponential backoff and stale data recovery on reconnect
- [ ] 03-02: Build persistent connection status indicator component

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure | 0/2 | Not started | - |
| 2. Core Realtime | 0/3 | Not started | - |
| 3. Resilience | 0/2 | Not started | - |
