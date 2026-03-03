---
phase: 02-core-realtime
verified: 2026-03-03T22:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Trigger a WhatsApp confirmation and observe the appointments list update"
    expected: "Status changes from 'reminder_sent' to 'confirmed' within 2 seconds on the appointments page without a manual refresh"
    why_human: "Requires a live Supabase Realtime WebSocket connection and a real or simulated WhatsApp webhook — cannot verify end-to-end latency programmatically"
  - test: "Open the app in two different browser tabs under two different tenants and trigger a status change in one"
    expected: "Only the tenant whose appointment changed sees the update; the other tab sees no change"
    why_human: "Cross-tenant isolation depends on RLS policies at the database level (Phase 1 deliverable) and requires two active sessions — cannot verify with grep"
  - test: "Trigger an appointment confirmation and observe the toast notification"
    expected: "A top-right toast appears reading 'Appuntamento confermato' with the service name, auto-dismisses after 4.5 seconds, and stacks up to 3 at once"
    why_human: "Toast rendering requires a live browser session with the Sonner component mounted — cannot verify appearance programmatically"
---

# Phase 2: Core Realtime Verification Report

**Phase Goal:** Appointment status changes from any source (WhatsApp, SMS, manual dashboard) appear on every staff browser within 2 seconds without a page refresh
**Verified:** 2026-03-03T22:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All truths derive from the ROADMAP.md Success Criteria for Phase 2 plus the per-plan must_haves.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Appointments list updates without manual refresh when a status changes | VERIFIED | `useRealtimeAppointments` wired into `appointments/page.tsx`; hook subscribes to `postgres_changes` on `appointments` table with `event: '*'` covering all status changes |
| 2 | Dashboard KPI cards reflect status changes in real-time | VERIFIED | `operational-dashboard.tsx` calls `useRealtimeAppointments`, then re-fetches `/api/dashboard` silently via `fetchAll(true)` whenever `realtimeAppointments` reference changes (skip-initial-mount pattern confirmed) |
| 3 | Calendar view updates appointment colors and labels when status changes | VERIFIED | `calendar/page.tsx` subscribes via `useRealtimeAppointments`, triggers `fetchData()` on `realtimeAppointments` change; `apptGrid` and `slotGrid` memoized to prevent flicker |
| 4 | Toast notification appears top-right on appointment confirmation (4-5s, stacks 3) | VERIFIED | `notifyIfConfirmed` in hook fires `toast.success` with `duration: 4500`; `<Toaster position="top-right" richColors visibleToasts={3} />` rendered in `layout.tsx` |
| 5 | No recurring polling requests to /api/appointments | VERIFIED | Zero `setInterval` or `setTimeout` in all three views (grep confirmed) |
| 6 | Cross-tenant isolation — each tenant sees only their appointments | VERIFIED (see human) | No `filter` parameter on subscription (RLS handles it); channel scoped to `appointments:{tenantId}`; SEC-01 requirement met architecturally |
| 7 | Subscribe-first-then-fetch prevents missed events during initial load | VERIFIED | Channel subscribed before `fetchInitial()` is called; pending events queued in `pendingEventsRef` until `initializedRef.current = true`; drained via `reduce` in single `setAppointments` call |
| 8 | INSERT/UPDATE/DELETE events merged immutably via applyDelta | VERIFIED | `applyDelta` returns new arrays for all three event types; no `.push()` or `.splice()` mutations; UPDATE preserves `patient` join field from existing state |
| 9 | Cleanup prevents channel leaks | VERIFIED | `useEffect` returns `() => supabase.removeChannel(channel)` (not `unsubscribe`) |
| 10 | Toast fires in live callback AND during pending drain | VERIFIED | `notifyIfConfirmed(event)` called in both the live `.on()` callback and the `for...of queued` loop in `fetchInitial` |
| 11 | service_role key not exposed in client-side code | VERIFIED | grep of entire `src/` for `SUPABASE_SERVICE_ROLE_KEY` and `service_role` returns only `src/lib/supabase/server.ts` — no client files |
| 12 | TypeScript compiles with zero errors | VERIFIED | `npx tsc --noEmit` exits 0 with no output |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/hooks/use-realtime-appointments.ts` | Core Realtime subscription hook (min 60 lines, exports `useRealtimeAppointments`) | VERIFIED | 165 lines; exports `useRealtimeAppointments`; subscribe-first-then-fetch; removeChannel cleanup |
| `src/lib/realtime/apply-delta.ts` | Immutable delta-merge (min 30 lines, exports `applyDelta`) | VERIFIED | 61 lines; exports `applyDelta`; handles INSERT/UPDATE/DELETE; preserves `patient` join on UPDATE |
| `src/lib/realtime/types.ts` | Type definitions (exports `RealtimeAppointmentEvent`, `UseRealtimeAppointmentsReturn`) | VERIFIED | Exports both types plus `RealtimeStatus`; all fields readonly |
| `src/app/(app)/appointments/page.tsx` | Appointments page with Realtime (contains `useRealtimeAppointments`) | VERIFIED | Imports and calls hook; client-side filtering and pagination via `useMemo`; no polling |
| `src/components/dashboard/operational-dashboard.tsx` | Dashboard with real-time KPI updates (contains `useRealtimeAppointments`) | VERIFIED | Imports and calls hook; Realtime-as-signal pattern for KPI re-fetch; liveRecentActivity derived from Realtime data |
| `src/app/(app)/calendar/page.tsx` | Calendar with real-time appointment updates (contains `useRealtimeAppointments`) | VERIFIED | Imports and calls hook; Realtime-triggered re-fetch; memoized slotGrid/apptGrid |
| `src/components/ui/sonner.tsx` | Sonner Toaster wrapper (shadcn) | VERIFIED | Exists; wraps Sonner with next-themes integration and lucide icons |
| `src/app/layout.tsx` | Root layout with Toaster component | VERIFIED | Imports and renders `<Toaster position="top-right" richColors visibleToasts={3} />` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `use-realtime-appointments.ts` | `supabase.channel().on('postgres_changes', ...)` | Supabase JS Realtime API | WIRED | `channel('appointments:${tenantId}').on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, callback)` confirmed at lines 77-108 |
| `use-realtime-appointments.ts` | `apply-delta.ts` | `import applyDelta` | WIRED | `import { applyDelta } from "@/lib/realtime/apply-delta"` at line 8; called at lines 101 and 136 |
| `use-realtime-appointments.ts` | `supabase/client.ts` | `import createClient` | WIRED | `import { createClient } from "@/lib/supabase/client"` at line 7; called at line 71 |
| `use-realtime-appointments.ts` | `sonner` | `import { toast } from 'sonner'` | WIRED | `import { toast } from "sonner"` at line 4; `toast.success(...)` at line 27 |
| `appointments/page.tsx` | `use-realtime-appointments.ts` | `import useRealtimeAppointments` | WIRED | Import at line 18; called at line 35 with `tenant?.id`; result destructured and used for data + loading state |
| `operational-dashboard.tsx` | `use-realtime-appointments.ts` | `import useRealtimeAppointments` | WIRED | Import at line 6; called at line 104; `realtimeAppointments` used as `useEffect` dependency and for `liveRecentActivity` |
| `calendar/page.tsx` | `use-realtime-appointments.ts` | `import useRealtimeAppointments` | WIRED | Import at line 20; called at line 58; `realtimeAppointments` used as `useEffect` dependency to trigger `fetchData()` |
| `layout.tsx` | `components/ui/sonner.tsx` | `import { Toaster }` | WIRED | `import { Toaster } from "@/components/ui/sonner"` at line 3; rendered at line 49 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RT-01 | 02-01, 02-02, 02-03 | Appointments list page updates within 1-2 seconds on status change | SATISFIED | Hook subscribes to `postgres_changes` with `event: '*'`; wired into appointments page; no polling |
| RT-02 | 02-02 | Dashboard KPI cards update in real-time | SATISFIED | Dashboard uses Realtime-as-signal pattern; re-fetches `/api/dashboard` silently on `realtimeAppointments` change |
| RT-03 | 02-02 | Calendar view reflects status changes in real-time | SATISFIED | CalendarPage wired to hook; re-fetches week data on Realtime events; grid computations memoized |
| RT-06 | 02-02 | 30-second polling replaced by Supabase Realtime subscriptions | SATISFIED | Zero `setInterval`/`setTimeout` in all three views — grep confirmed |
| RT-07 | 02-01 | Multi-channel sync — WhatsApp/SMS/email/cron/manual all trigger same update | SATISFIED | `postgres_changes` subscription fires on ANY row mutation to `appointments` table, regardless of write source; all update paths go through the same table |
| SEC-01 | 02-01 | Realtime subscriptions are tenant-scoped (no cross-tenant leaks) | SATISFIED | No `filter` param on subscription (RLS/WALRUS handles server-side); channel name includes `tenantId` for logical isolation |
| SEC-02 | 02-03 | service_role key never exposed in client-side code or NEXT_PUBLIC_ vars | SATISFIED | grep of `src/` confirms `SUPABASE_SERVICE_ROLE_KEY` only in `src/lib/supabase/server.ts` |

**All 7 requirements for Phase 2 are SATISFIED.**

No orphaned requirements: REQUIREMENTS.md traceability table maps RT-01, RT-02, RT-03, RT-06, RT-07, SEC-01, SEC-02 to Phase 2 and all are accounted for in plan frontmatter. RT-04 and RT-05 are correctly deferred to Phase 3.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `appointments/page.tsx` | 91 | `placeholder="From date"` | Info | HTML input attribute — legitimate UI text, not a code stub |

No blockers or warnings found. The single match is a false positive (HTML attribute).

### Human Verification Required

#### 1. End-to-End Real-Time Latency

**Test:** Trigger a WhatsApp confirmation webhook (or manually update an appointment status in Supabase Dashboard) with the browser open on `/appointments`
**Expected:** Appointment status changes on-screen within 2 seconds with no manual refresh
**Why human:** Requires live Supabase Realtime WebSocket connection; end-to-end latency cannot be measured statically

#### 2. Cross-Tenant Isolation

**Test:** Open the app in two different browser sessions (or incognito windows) logged in as two different tenants; update an appointment in tenant A
**Expected:** Tenant B's browser shows no change; only tenant A's session updates
**Why human:** Requires two live sessions and verifying RLS policy enforcement at runtime — the architecture is correct but runtime enforcement must be observed

#### 3. Toast Notification Appearance and Behavior

**Test:** Confirm an appointment (via WhatsApp or manual Supabase update) with the app open
**Expected:** A top-right toast appears reading "Appuntamento confermato" with the service name; auto-dismisses after ~4.5 seconds; a third concurrent toast can stack without earlier ones disappearing
**Why human:** Toast rendering requires a live browser session; visual appearance and timing cannot be verified statically

### Gaps Summary

No gaps found. All automated checks passed:
- All 8 artifacts exist and are substantive (no stubs)
- All 8 key links are wired (import + usage confirmed)
- All 7 phase requirements satisfied
- Zero polling code in the three modified views
- TypeScript compiles clean (exit code 0)
- SEC-02 confirmed: service_role key isolated to server-side code only
- All 6 documented commits verified in git history
- `sonner` package present in `package.json` at version `^2.0.7`

The 3 human verification items are observability checks on live behavior — the underlying implementation is verified as correct.

---

_Verified: 2026-03-03T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
