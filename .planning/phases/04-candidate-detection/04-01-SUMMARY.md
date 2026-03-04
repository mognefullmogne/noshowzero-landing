---
phase: 04-candidate-detection
plan: 01
subsystem: testing
tags: [vitest, typescript, scoring, postgresql, migration]

# Dependency graph
requires: []
provides:
  - vitest test framework with @/ path alias, running via `npm test`
  - CandidateScoreBreakdown interface in src/lib/types.ts
  - computeCandidateScore pure function in src/lib/scoring/candidate-score.ts
  - WaitlistOffer.waitlist_entry_id made nullable
  - WaitlistOffer.candidate_appointment_id field added
  - supabase/migrations/012_candidate_detection.sql (schema changes + indexes)
  - createMockSupabase factory in src/lib/backfill/__tests__/helpers.ts
  - 8 passing scoring tests covering distance bands and reliability
  - 15 todo test stubs for findCandidates and triggerBackfill (Plans 02/03)
affects:
  - 04-02 (find-candidates implementation — uses types, helpers, stubs)
  - 04-03 (trigger-backfill implementation — uses types, helpers, stubs)

# Tech tracking
tech-stack:
  added: [vitest@4.0.18]
  patterns:
    - Pure function scoring with immutable return objects (Object.freeze)
    - Vitest with @/ path alias matching tsconfig.json
    - createMockSupabase factory pattern for unit test isolation
    - TDD stubs (it.todo) scaffolded before implementation

key-files:
  created:
    - vitest.config.ts
    - src/lib/scoring/candidate-score.ts
    - src/lib/backfill/__tests__/helpers.ts
    - src/lib/backfill/__tests__/find-candidates.test.ts
    - src/lib/backfill/__tests__/trigger-backfill.test.ts
    - src/lib/scoring/__tests__/candidate-score.test.ts
    - supabase/migrations/012_candidate_detection.sql
  modified:
    - package.json (added test script and vitest devDependency)
    - src/lib/types.ts (CandidateScoreBreakdown added, WaitlistOffer updated)

key-decisions:
  - "Two-factor scoring: appointmentDistance (0-60 primary) + reliability (0-40 tiebreaker)"
  - "Distance bands: 0-7d=10, 7-14d=20, 14-30d=35, 30-60d=45, 60+d=60 — farther out scores higher"
  - "New patients (<2 total) get neutral reliability score of 20 to avoid penalizing first-timers"
  - "waitlist_entry_id made nullable to support appointment-based candidates (not just waitlist)"

patterns-established:
  - "Pure scoring functions: take input struct, return frozen result object, no side effects"
  - "Test stubs (it.todo) scaffolded first so Plans 02/03 know exactly what behaviors to implement"
  - "createMockSupabase: class-based, typed as SupabaseClient, each .from() returns fresh builder"

requirements-completed: [SLOT-01, SLOT-02]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 4 Plan 1: Candidate Detection Foundation Summary

**Vitest installed with @/ alias, CandidateScoreBreakdown type + pure scoring function with 2-factor distance/reliability algorithm, migration 012 schema changes, and 23 test cases (8 passing, 15 stubs)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T13:51:11Z
- **Completed:** 2026-03-04T13:53:37Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Vitest installed and configured with @/ path alias, `npm test` works
- CandidateScoreBreakdown interface and computeCandidateScore pure function with 2-factor scoring
- Migration 012 makes waitlist_entry_id nullable, adds candidate_appointment_id, creates 2 performance indexes
- 8 passing scoring tests covering all distance bands and reliability formula
- 15 todo stubs (10 findCandidates + 5 triggerBackfill) scaffolded for Plans 02 and 03

## Task Commits

Each task was committed atomically:

1. **Task 1: Install vitest, type contracts, scoring function** - `51bd7f7` (feat)
2. **Task 2: Migration, test stubs, scoring tests** - `2cff6e3` (test)

**Plan metadata:** [docs commit, see below]

## Files Created/Modified

- `vitest.config.ts` - Vitest configuration with @/ alias and node environment
- `package.json` - Added `"test": "vitest run"` script and vitest devDependency
- `src/lib/types.ts` - Added CandidateScoreBreakdown interface; WaitlistOffer.waitlist_entry_id nullable + candidate_appointment_id field
- `src/lib/scoring/candidate-score.ts` - Pure computeCandidateScore function with 2-factor algorithm
- `src/lib/scoring/__tests__/candidate-score.test.ts` - 8 full passing tests for scoring
- `src/lib/backfill/__tests__/helpers.ts` - createMockSupabase factory (class-based, SupabaseClient typed)
- `src/lib/backfill/__tests__/find-candidates.test.ts` - 10 todo stubs for Plan 02
- `src/lib/backfill/__tests__/trigger-backfill.test.ts` - 5 todo stubs for Plan 03
- `supabase/migrations/012_candidate_detection.sql` - Schema + index changes for appointment-based candidates

## Decisions Made

- Two-factor scoring: appointmentDistance (0-60, primary) + reliability (0-40, tiebreaker). Farther appointments score highest because those patients benefit most from an earlier slot.
- Distance bands are discrete, not continuous, to keep the scoring intuitive and auditable.
- New patients (<2 appointments) get neutral reliability of 20 — avoids penalizing first-timers who have no history.
- Used `Object.freeze()` on scoring output to enforce immutability at runtime.

## Deviations from Plan

None - plan executed exactly as written. The helpers.ts file was improved by the linter (class-based approach, typed as SupabaseClient) which is an improvement over the original procedural approach without changing behavior.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Migration 012 will be applied during Plan 02 or 03 when the Supabase instance is targeted.

## Next Phase Readiness

- Plan 02 (find-candidates implementation) can begin immediately — test stubs are ready, types compile, Supabase mock factory is available
- Plan 03 (trigger-backfill) stubs are also ready
- `npx vitest run` runs cleanly, `npx tsc --noEmit` compiles cleanly

## Self-Check: PASSED

All 9 files verified present on disk. Both task commits (51bd7f7, 2cff6e3) confirmed in git log.

---
*Phase: 04-candidate-detection*
*Completed: 2026-03-04*
