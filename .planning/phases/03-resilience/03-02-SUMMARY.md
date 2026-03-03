---
phase: 03-resilience
plan: 02
subsystem: ui
tags: [react-context, websocket, connection-status, supabase-realtime, accessibility]

# Dependency graph
requires:
  - phase: 03-resilience/01
    provides: "useRealtimeAppointments hook with reconnection, realtimeStatus state, RealtimeStatus type"
provides:
  - "ConnectionStatus component showing Live/Reconnecting/Offline badge"
  - "RealtimeStatusContext bridging page-level hook status to layout-level indicator"
  - "Persistent sidebar indicator visible on all dashboard pages"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["React context bridge for cross-level state sharing (page hook to layout component)"]

key-files:
  created:
    - src/contexts/realtime-status-context.tsx
    - src/components/shared/connection-status.tsx
  modified:
    - src/hooks/use-realtime-appointments.ts
    - src/app/(app)/layout.tsx
    - src/components/dashboard/operational-dashboard.tsx

key-decisions:
  - "React context bridge over prop drilling -- lightest-weight solution for page-to-layout state"
  - "Only SUBSCRIBED maps to Live -- all other statuses show non-live state for safety"
  - "Removed hardcoded badge entirely rather than replacing with dynamic version in dashboard body"

patterns-established:
  - "Context bridge pattern: page-level hooks push state into context, layout-level components read from it"
  - "STATUS_CONFIG const object pattern: map status enum values to visual config (label, className, dotClassName)"

requirements-completed: [RT-04]

# Metrics
duration: 8min
completed: 2026-03-03
---

# Phase 3 Plan 2: Connection Status Indicator Summary

**Persistent Live/Reconnecting/Offline badge in sidebar header powered by React context bridge from page-level Realtime hooks**

## Performance

- **Duration:** 8 min (continuation from checkpoint)
- **Started:** 2026-03-03T22:12:07Z
- **Completed:** 2026-03-03T22:20:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- ConnectionStatus component renders green "Live", amber "Riconnessione...", or red "Offline" badge based on actual WebSocket channel state
- RealtimeStatusContext bridges realtimeStatus from page-level useRealtimeAppointments hook to layout-level sidebar indicator
- Hardcoded always-green "Aggiornamento live" badge removed from operational dashboard -- indicator never shows Live when channel is not SUBSCRIBED
- Badge persists across all dashboard pages (sidebar is always visible)
- Human-verified end-to-end: WebSocket connects, indicator shows "Live", reflects actual connection state

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RealtimeStatusContext, ConnectionStatus component, and wire into layout** - `113962e` (feat)
2. **Task 2: Remove hardcoded live badge from operational dashboard** - `1ce19ff` (fix)
3. **Task 3: Verify connection status indicator end-to-end** - checkpoint:human-verify (approved)

## Files Created/Modified

- `src/contexts/realtime-status-context.tsx` - React context provider/consumers bridging realtimeStatus from hooks to layout
- `src/components/shared/connection-status.tsx` - Badge component with STATUS_CONFIG mapping, role="status" for accessibility
- `src/hooks/use-realtime-appointments.ts` - Added useRealtimeStatusSetter call to push status into context
- `src/app/(app)/layout.tsx` - Wrapped with RealtimeStatusProvider, added ConnectionStatus to sidebar header
- `src/components/dashboard/operational-dashboard.tsx` - Removed hardcoded "Aggiornamento live" badge

## Decisions Made

- **React context bridge over prop drilling**: The hook runs in page components, but the indicator lives in the layout. A context provider in the layout is the lightest-weight bridge -- no prop drilling, no duplicate subscriptions, no global store.
- **Only SUBSCRIBED maps to "Live"**: CONNECTING shows amber, CLOSED/TIMED_OUT/CHANNEL_ERROR show red. The badge never falsely indicates a live connection.
- **Removed hardcoded badge entirely**: Rather than replacing the hardcoded dashboard badge with the dynamic ConnectionStatus component in the dashboard body, it was removed entirely since the sidebar header already shows the indicator globally on every page.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Vercel env var trailing newline**: The deployed application's WebSocket connection was failing because the `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variable in Vercel had a trailing newline character. The user fixed this by re-pasting the key, after which the connection succeeded and the indicator showed "Live". This was an environment configuration issue, not a code issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- This is the final plan of the final phase. All v1 milestone requirements are now complete.
- RT-04 (connection state indicator) is satisfied.
- The entire real-time system is now resilient: reconnection with exponential backoff (Plan 03-01), stale data recovery (Plan 03-01), and persistent connection status indicator (Plan 03-02).

## Self-Check: PASSED

- All 5 source files exist
- Both task commits verified (113962e, 1ce19ff)
- No "Aggiornamento live" hardcoded badge found in codebase

---
*Phase: 03-resilience*
*Completed: 2026-03-03*
