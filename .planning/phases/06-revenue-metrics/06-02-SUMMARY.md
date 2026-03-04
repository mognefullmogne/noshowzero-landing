---
phase: 06-revenue-metrics
plan: 02
subsystem: ui
tags: [react, settings, dashboard, kpi, metrics, zod, react-hook-form]

# Dependency graph
requires:
  - phase: 06-revenue-metrics
    provides: "RecoveryMetrics type, GET/PATCH /api/settings/tenant, honest analytics API with slotsRecovered/fillRatePercent/revenueRecovered/activeOffers"
provides:
  - "Settings page with tenant appointment value configuration (EUR input, fetch/save)"
  - "Dashboard KPI section showing honest recovery metrics (slots recovered, revenue, fill rate, active offers)"
  - "Backward-compatible KPI cards falling back to legacy analytics fields"
affects: [07-dashboard-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns: [settings-form-pattern, recovery-kpi-cards]

key-files:
  created: []
  modified:
    - src/app/(app)/settings/page.tsx
    - src/components/dashboard/operational-dashboard.tsx

key-decisions:
  - "Used valueAsNumber register option instead of z.coerce.number() to avoid Zod 4 + react-hook-form type incompatibility"
  - "New KPI fields marked optional in AnalyticsData interface for backward compatibility with older API responses"
  - "Clinic settings section placed between Profile and Password for logical grouping"

patterns-established:
  - "Settings form pattern: fetch on mount via loadSettings, PATCH on submit, loading/saved/error states with 3s auto-dismiss"
  - "Recovery KPI cards: prefer new field ?? legacy field ?? 0 for backward compatibility"

requirements-completed: [METR-02, METR-03]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 6 Plan 2: Revenue Metrics Frontend Summary

**Appointment value configuration in Settings and recovery-focused KPI cards on dashboard using honest analytics API**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T16:00:35Z
- **Completed:** 2026-03-04T16:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Settings page now has "Impostazioni Clinica" section with EUR input for avg_appointment_value, fetching from and saving to /api/settings/tenant
- Dashboard Overall Stats replaced with 4 recovery-focused KPI cards: slots recovered, revenue recovered, fill rate %, active offers
- Backfill Engine fill rate card updated to use METR-04 formula (fillRatePercent)
- All values sourced from honest analytics API with backward-compatible fallbacks

## Task Commits

Each task was committed atomically:

1. **Task 1: Add appointment value configuration to Settings page** - `79dc664` (feat)
2. **Task 2: Update dashboard KPI cards to show honest recovery metrics** - `0355f11` (feat)

## Files Created/Modified
- `src/app/(app)/settings/page.tsx` - Added clinic settings section with Euro icon, number input (step 0.01, min 1, max 10000), Zod validation, fetch/save handlers
- `src/components/dashboard/operational-dashboard.tsx` - Extended AnalyticsData interface with new fields, replaced Overall Stats with recovery KPIs, updated Backfill Engine fill rate

## Decisions Made
- Used `valueAsNumber: true` in react-hook-form register instead of `z.coerce.number()` -- Zod 4.x `z.coerce` produces `unknown` input type that is incompatible with zodResolver generics
- Made new AnalyticsData fields optional (`slotsRecovered?: number`) so dashboard works with both old and new API responses during transition
- Positioned clinic settings between Profile and Password sections for logical grouping (tenant-level config separate from user-level config)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed z.coerce.number() type incompatibility with react-hook-form**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `z.coerce.number()` in Zod 4.x produces `z.ZodType<number, unknown>` which conflicts with react-hook-form's zodResolver expecting matching input/output types
- **Fix:** Changed to `z.number()` with `{ valueAsNumber: true }` on the register call, letting HTML handle string-to-number coercion
- **Files modified:** src/app/(app)/settings/page.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 79dc664 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type-level fix. Same user-facing behavior. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 (Revenue Metrics) is now complete -- both backend (06-01) and frontend (06-02) shipped
- Dashboard displays honest recovery metrics from the corrected analytics API
- Settings page allows tenants to configure their appointment value
- Ready for Phase 7 dashboard redesign

## Self-Check: PASSED

All 2 modified files verified present. All 2 commits verified in git history.

---
*Phase: 06-revenue-metrics*
*Completed: 2026-03-04*
