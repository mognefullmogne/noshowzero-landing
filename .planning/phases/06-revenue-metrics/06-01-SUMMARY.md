---
phase: 06-revenue-metrics
plan: 01
subsystem: api
tags: [metrics, analytics, revenue, supabase, zod, vitest]

# Dependency graph
requires:
  - phase: 04-candidate-detection
    provides: "waitlist_offers table with status and new_appointment_id columns"
  - phase: 05-whatsapp-cascade
    provides: "cascade accept flow that creates new_appointment_id on waitlist_offers"
provides:
  - "Pure recovery metric functions (computeFillRate, computeRevenueRecovered, computeRecoveryMetrics)"
  - "Per-tenant configurable avg_appointment_value in DB"
  - "PATCH /api/settings/tenant for updating appointment value"
  - "Honest analytics using only accepted offers with new_appointment_id"
  - "RecoveryMetrics interface in types.ts"
affects: [07-dashboard-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-function-metrics, tenant-configurable-values]

key-files:
  created:
    - src/lib/metrics/recovery-metrics.ts
    - src/lib/metrics/recovery-metrics.test.ts
    - src/app/api/settings/tenant/route.ts
    - supabase/migrations/013_tenant_appointment_value.sql
  modified:
    - src/lib/types.ts
    - src/app/api/analytics/route.ts
    - src/app/api/v1/analytics/summary/route.ts
    - src/lib/kpi/compute-snapshot.ts
    - src/lib/validations.ts
    - src/hooks/use-tenant.ts

key-decisions:
  - "Default avg_appointment_value set to EUR 80 matching existing compute-snapshot default"
  - "Recovery = only accepted offers with new_appointment_id (honest metric per METR-01)"
  - "Fill rate denominator = cancelled + noShow (METR-04 formula)"
  - "Backward-compatible: waitlistFills and revenueSaved fields preserved with honest values"

patterns-established:
  - "Pure metric functions: business logic extracted to testable pure functions separate from API routes"
  - "Tenant-configurable values: per-tenant settings stored in DB, fetched at query time, not hardcoded"

requirements-completed: [METR-01, METR-03, METR-04]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 6 Plan 1: Revenue Metrics Summary

**Honest recovery metrics using only accepted waitlist offers, per-tenant configurable appointment value, and METR-04 fill rate formula**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T15:52:16Z
- **Completed:** 2026-03-04T15:56:53Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Pure metric functions with 13 passing tests computing fill rate, revenue recovered, and slots recovered
- Analytics API now counts only accepted waitlist_offers with new_appointment_id as "recovered"
- PATCH /api/settings/tenant allows updating avg_appointment_value (validated: positive, max 10000)
- All hardcoded AVG_APPOINTMENT_VALUE constants removed from analytics, KPI, and v1 API modules

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration, types, and pure recovery metric functions** (TDD)
   - `4aaf7e7` (test) - RED: failing tests for recovery metrics
   - `7432b10` (feat) - GREEN: implementation passing all tests
2. **Task 2: Fix analytics API and add tenant settings endpoint** - `83f54ac` (feat)

## Files Created/Modified
- `supabase/migrations/013_tenant_appointment_value.sql` - Adds avg_appointment_value column to tenants (default EUR 80)
- `src/lib/types.ts` - RecoveryMetrics interface added
- `src/lib/metrics/recovery-metrics.ts` - Pure functions: computeFillRate, computeRevenueRecovered, computeRecoveryMetrics
- `src/lib/metrics/recovery-metrics.test.ts` - 13 tests covering edge cases and honest counting
- `src/hooks/use-tenant.ts` - avg_appointment_value added to Tenant interface and select query
- `src/app/api/analytics/route.ts` - Rewritten revenue section using honest recovery metrics
- `src/app/api/settings/tenant/route.ts` - New GET/PATCH endpoint for tenant settings
- `src/lib/kpi/compute-snapshot.ts` - Removed hardcoded value, accepts optional avgAppointmentValue param
- `src/lib/validations.ts` - TenantSettingsUpdateSchema added
- `src/app/api/v1/analytics/summary/route.ts` - Fixed to use honest recovery metrics

## Decisions Made
- Default avg_appointment_value set to EUR 80 matching existing compute-snapshot default (not 150 which was in the analytics route)
- Recovery metric is strict: ONLY accepted offers with new_appointment_id count as recovered (per METR-01)
- Fill rate uses METR-04 formula: slotsRecovered / (cancelled + noShow) x 100
- Backward compatibility preserved: waitlistFills and revenueSaved response fields kept but populated with honest values
- New response fields (slotsRecovered, fillRatePercent, revenueRecovered, activeOffers) added for Phase 7 dashboard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed v1 analytics summary endpoint**
- **Found during:** Task 2 (verification step)
- **Issue:** src/app/api/v1/analytics/summary/route.ts also had hardcoded AVG_APPOINTMENT_VALUE = 150 and inflated revenue calculation
- **Fix:** Rewrote to use computeRecoveryMetrics with tenant's configurable value
- **Files modified:** src/app/api/v1/analytics/summary/route.ts
- **Verification:** grep confirms no hardcoded values remain; TypeScript compiles cleanly
- **Committed in:** 83f54ac (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Zod error property access**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Used `.errors` instead of `.issues` on ZodError in tenant settings route
- **Fix:** Changed to `parsed.error.issues` with proper type annotation
- **Files modified:** src/app/api/settings/tenant/route.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 83f54ac (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. The v1 API fix ensures consistency across all analytics endpoints. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Honest recovery metrics available for Phase 7 dashboard redesign
- New response fields (slotsRecovered, fillRatePercent, revenueRecovered, activeOffers) ready for consumption
- Tenant settings endpoint ready for a settings UI in the dashboard

## Self-Check: PASSED

All 11 files verified present. All 3 commits verified in git history.

---
*Phase: 06-revenue-metrics*
*Completed: 2026-03-04*
