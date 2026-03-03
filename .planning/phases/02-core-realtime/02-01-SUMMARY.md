---
phase: 02-core-realtime
plan: 01
subsystem: realtime
tags: [supabase-realtime, react-hooks, postgres-changes, websocket, delta-merge, immutable-state]

# Dependency graph
requires:
  - phase: 01-infrastructure
    provides: "appointments table in supabase_realtime publication with REPLICA IDENTITY FULL and RLS policies"
provides:
  - "useRealtimeAppointments hook for subscribing to live appointment changes"
  - "applyDelta pure function for immutable state merging of INSERT/UPDATE/DELETE events"
  - "RealtimeAppointmentEvent and UseRealtimeAppointmentsReturn type definitions"
affects: [02-02-PLAN, 02-03-PLAN, dashboard, appointments-page, calendar-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [subscribe-first-then-fetch, immutable-delta-merge, tenant-scoped-channels, rls-based-realtime-filtering]

key-files:
  created:
    - src/hooks/use-realtime-appointments.ts
    - src/lib/realtime/apply-delta.ts
    - src/lib/realtime/types.ts
  modified: []

key-decisions:
  - "Cast Supabase payload through unknown for type safety with Record<string, unknown> to Appointment conversion"
  - "Drain queued events via reduce (single state update) rather than sequential setAppointments calls for efficiency"
  - "Use 'CONNECTING' as initial realtimeStatus before subscription callback fires"

patterns-established:
  - "Subscribe-first-then-fetch: subscribe to channel before initial REST fetch to prevent missed events"
  - "Immutable delta-merge: applyDelta returns new arrays, preserves joined patient data on UPDATE"
  - "Tenant-scoped channel naming: appointments:{tenantId} for logical isolation"
  - "RLS-only filtering: no client-side filter parameter on postgres_changes subscription"

requirements-completed: [RT-01, RT-07, SEC-01]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 2 Plan 1: Realtime Subscription Hook Summary

**useRealtimeAppointments hook with subscribe-first-then-fetch pattern, immutable applyDelta delta-merge, and tenant-scoped Supabase Realtime channels**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T21:06:32Z
- **Completed:** 2026-03-03T21:09:13Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Created `useRealtimeAppointments` hook that subscribes to Supabase Realtime postgres_changes on the appointments table using the subscribe-first-then-fetch pattern to prevent missed events
- Built pure `applyDelta` function that immutably merges INSERT/UPDATE/DELETE events into React state, preserving the `patient` join field on UPDATEs (Realtime events lack JOINed data)
- Defined strict TypeScript types (RealtimeAppointmentEvent, UseRealtimeAppointmentsReturn, RealtimeStatus) with readonly fields throughout

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Realtime types and delta-merge utility** - `facf999` (feat)
2. **Task 2: Create useRealtimeAppointments hook** - `3322742` (feat)

**Plan metadata:** (pending -- docs commit)

## Files Created/Modified
- `src/lib/realtime/types.ts` - RealtimeAppointmentEvent, RealtimeStatus, UseRealtimeAppointmentsReturn type definitions
- `src/lib/realtime/apply-delta.ts` - Pure immutable delta-merge function handling INSERT (dedup), UPDATE (preserve patient), DELETE
- `src/hooks/use-realtime-appointments.ts` - Core Realtime subscription hook with subscribe-first-then-fetch, event queuing, tenant-scoped channel, removeChannel cleanup

## Decisions Made
- Cast Supabase `Record<string, unknown>` payload through `unknown` before casting to `Appointment` -- required by TypeScript strict mode since the types don't overlap directly
- Drain queued pending events using `reduce` in a single `setAppointments` call rather than calling `setAppointments` for each queued event -- avoids intermediate re-renders during initialization
- Set initial `realtimeStatus` to `"CONNECTING"` rather than a null/empty state -- provides meaningful status before the Supabase subscription callback fires

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript cast through unknown for Supabase payload**
- **Found during:** Task 1 (delta-merge utility)
- **Issue:** Direct cast from `Record<string, unknown>` to `Appointment` fails TypeScript strict mode (TS2352: types don't sufficiently overlap)
- **Fix:** Added intermediate `unknown` cast: `payload.new as unknown as Appointment`
- **Files modified:** `src/lib/realtime/apply-delta.ts`
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** facf999 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard TypeScript strictness fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Supabase Realtime is already enabled (Phase 1 infrastructure).

## Next Phase Readiness
- Hook is ready for Plans 02 and 03 to wire into AppointmentsPage, OperationalDashboard, and CalendarPage
- Plans 02-03 will import `useRealtimeAppointments` from `@/hooks/use-realtime-appointments`
- Sonner toast integration (Plan 03) will add notification logic separate from the hook (separation of concerns)
- No blockers for next plan

## Self-Check: PASSED

- All 3 source files exist
- Both task commits verified (facf999, 3322742)
- `npx tsc --noEmit` passes with zero errors

---
*Phase: 02-core-realtime*
*Completed: 2026-03-03*
