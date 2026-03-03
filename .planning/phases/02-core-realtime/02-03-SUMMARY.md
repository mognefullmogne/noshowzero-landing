---
phase: 02-core-realtime
plan: 03
subsystem: ui
tags: [sonner, toast-notifications, realtime, shadcn, security-verification]

# Dependency graph
requires:
  - phase: 02-core-realtime
    plan: 01
    provides: "useRealtimeAppointments hook with subscribe-first-then-fetch pattern and applyDelta"
provides:
  - "Sonner toast notification system installed and wired into root layout"
  - "Confirmation toast fired from realtime hook when appointment status changes to confirmed"
  - "SEC-02 verified: no service_role key exposure in client-side code"
affects: [dashboard, appointments-page, calendar-page]

# Tech tracking
tech-stack:
  added: [sonner]
  patterns: [extracted-notification-helper, toast-on-realtime-event]

key-files:
  created:
    - src/components/ui/sonner.tsx
  modified:
    - src/app/layout.tsx
    - src/hooks/use-realtime-appointments.ts

key-decisions:
  - "Extract notifyIfConfirmed as a standalone function to DRY toast logic between live callback and pending drain"
  - "Keep shadcn-generated sonner.tsx with next-themes integration unchanged (useTheme defaults safely without ThemeProvider)"

patterns-established:
  - "Toast notification from Realtime events: fire toast after applyDelta, not during initial fetch"
  - "Toaster in root layout: single Toaster component in layout.tsx for app-wide toast support"

requirements-completed: [RT-01, SEC-02]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 2 Plan 3: Toast Notifications Summary

**Sonner toast notifications on appointment confirmation via Realtime events with SEC-02 service_role key verification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T21:12:10Z
- **Completed:** 2026-03-03T21:14:49Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed Sonner via shadcn CLI and added Toaster to root layout with position=top-right, richColors, and visibleToasts=3
- Added `notifyIfConfirmed` helper to the realtime hook that fires `toast.success("Appuntamento confermato")` when an UPDATE event transitions an appointment to "confirmed" status
- Toast fires both in the live callback and during pending events drain (events that arrived during subscribe-fetch gap)
- SEC-02 verified: zero references to `service_role` or `SUPABASE_SERVICE_ROLE_KEY` in any client-side source file

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Sonner and add Toaster to root layout** - `65a84a1` (feat)
2. **Task 2: Add confirmation toast to hook and verify SEC-02** - `8231cd7` (feat)

**Plan metadata:** `9b85734` (docs: complete plan)

## Files Created/Modified
- `src/components/ui/sonner.tsx` - Shadcn Toaster wrapper component with next-themes integration and lucide icons
- `src/app/layout.tsx` - Root layout now renders `<Toaster position="top-right" richColors visibleToasts={3} />`
- `src/hooks/use-realtime-appointments.ts` - Added sonner import, `notifyIfConfirmed` helper, toast calls in live callback and pending drain
- `package.json` / `package-lock.json` - Added sonner dependency

## Decisions Made
- Extracted `notifyIfConfirmed` as a standalone function outside the hook to keep the callback clean and DRY between the live subscription callback and the pending events drain loop
- Kept the shadcn-generated sonner.tsx with `useTheme()` from next-themes unchanged -- the hook defaults safely to `"system"` theme even without a ThemeProvider wrapping the app
- Removed unused `useCallback` import from the hook file (cleanup from Plan 01)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - Sonner is a client-side library with no external configuration required.

## Next Phase Readiness
- Toast notifications are fully wired: any page using `useRealtimeAppointments` will automatically get confirmation toasts
- The Toaster in root layout means toasts work on all pages (dashboard, calendar, appointments)
- No blockers for remaining phase work

## Self-Check: PASSED

- All 3 source files exist and contain expected content
- Both task commits verified (65a84a1, 8231cd7)
- `npx tsc --noEmit` passes with zero errors
- `npm run build` passes with zero errors
- SEC-02 verified: no service_role in client code

---
*Phase: 02-core-realtime*
*Completed: 2026-03-03*
