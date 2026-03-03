---
phase: 03-resilience
plan: 01
subsystem: realtime
tags: [supabase, realtime, websocket, reconnection, exponential-backoff, web-worker]

# Dependency graph
requires:
  - phase: 02-core-realtime
    provides: useRealtimeAppointments hook with subscribe-first-then-fetch pattern
provides:
  - Channel-level reconnection with exponential backoff (1s-30s, max 5 attempts)
  - Stale data recovery via REST re-fetch on successful re-subscription
  - Background tab resilience via Web Worker heartbeat (worker: true)
  - Visibility change listener for tab-return reconnection
  - Auth session refresh before channel creation
affects: [03-resilience]

# Tech tracking
tech-stack:
  added: []
  patterns: [reconnectTrigger state counter for useEffect re-run, exponential backoff with jitter cap]

key-files:
  created: []
  modified:
    - src/lib/supabase/client.ts
    - src/lib/realtime/types.ts
    - src/hooks/use-realtime-appointments.ts

key-decisions:
  - "reconnectTrigger pattern: state counter forces useEffect re-run for clean channel teardown/recreation"
  - "Fire-and-forget auth.getSession() before subscription to handle overnight token expiry"

patterns-established:
  - "reconnectTrigger pattern: increment state counter to force useEffect re-run, leveraging cleanup for old channel teardown"
  - "Stale data recovery: hasBeenSubscribedRef distinguishes first connection from re-connection to trigger REST re-fetch"
  - "Timer leak prevention: always clear existing timeout before scheduling new one"

requirements-completed: [RT-05]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 3 Plan 1: Reconnection & Stale Data Recovery Summary

**Channel-level reconnection with exponential backoff, stale data recovery via REST re-fetch, and Web Worker heartbeat for background tab resilience**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T21:39:59Z
- **Completed:** 2026-03-03T21:42:01Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Supabase client configured with `worker: true` to prevent browser tab throttling from killing the 25-second heartbeat interval
- Channel-level failures (CLOSED, TIMED_OUT, CHANNEL_ERROR) now trigger automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s) up to 5 attempts
- Successful re-subscription triggers full REST re-fetch to recover stale data missed during disconnection
- Visibility change listener resets reconnect counter when returning to a dormant tab, enabling recovery after overnight sessions
- Auth session refresh fires before each channel creation to handle expired tokens

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure Supabase client with worker heartbeat and add reconnection types** - `669caf8` (feat)
2. **Task 2: Add channel-level reconnection and stale data recovery to useRealtimeAppointments** - `9828c00` (feat)

## Files Created/Modified
- `src/lib/supabase/client.ts` - Added realtime options: worker: true and heartbeatCallback for background tab resilience
- `src/lib/realtime/types.ts` - Added RECONNECTABLE_STATUSES constant and MAX_RECONNECT_ATTEMPTS constant
- `src/hooks/use-realtime-appointments.ts` - Added reconnectTrigger pattern, exponential backoff, stale data recovery, visibilitychange listener, auth refresh, timer cleanup

## Decisions Made
- Used reconnectTrigger state counter pattern (from 03-RESEARCH.md) for clean channel teardown/recreation via useEffect lifecycle
- Fire-and-forget `supabase.auth.getSession()` call before subscription handles overnight token expiry without blocking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Reconnection infrastructure complete, hook now survives network drops and tab switches
- Plan 03-02 (ConnectionStatus indicator component) can now read `realtimeStatus` from the hook to display live/reconnecting/offline states
- The hook's return type is unchanged -- no breaking changes for existing consumers

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 03-resilience*
*Completed: 2026-03-03*
