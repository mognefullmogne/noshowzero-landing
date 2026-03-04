---
phase: 04-candidate-detection
plan: 02
subsystem: api
tags: [typescript, vitest, tdd, appointments, scoring, supabase, backfill]

# Dependency graph
requires:
  - phase: 04-01
    provides: CandidateScoreBreakdown type, computeCandidateScore function, createMockSupabase helper, test stubs
provides:
  - findCandidates function querying appointments table (not waitlist_entries)
  - OpenSlotDetails interface with cancellingPatientId for self-exclusion
  - RankedCandidate interface with candidateAppointmentId + candidateScore fields
  - 10 passing tests covering all SLOT-01/SLOT-02 filtering and scoring behaviors
  - hasTimeConflict, deduplicateByPatient, buildStatsMap helper functions
  - Updated send-offer.ts: uses candidateAppointmentId, candidateScore, no waitlist_entries update
  - Updated trigger-backfill.ts: passes cancellingPatientId, no service/location fields
affects:
  - 04-03 (trigger-backfill implementation uses updated OpenSlotDetails/RankedCandidate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED-GREEN-REFACTOR cycle with vitest and createMockSupabase mock factory
    - Typed AppointmentRow interface for untyped Supabase query results (cast from unknown)
    - Belt-and-suspenders post-query filter for cancelling patient (DB + application layer)
    - Two-query pattern: fetch candidates, then fetch no-show stats only for remaining patients
    - Set<string> for O(1) declined-patient lookup during post-query filtering

key-files:
  created:
    - src/lib/backfill/__tests__/find-candidates.test.ts (10 real tests replacing todo stubs)
  modified:
    - src/lib/backfill/find-candidates.ts (complete rewrite — appointments table, OpenSlotDetails, RankedCandidate)
    - src/lib/backfill/__tests__/helpers.ts (class-based MockQueryBuilder with proper instance isolation)
    - src/lib/backfill/send-offer.ts (updated to use candidateAppointmentId, candidateScore)
    - src/lib/backfill/trigger-backfill.ts (updated to pass cancellingPatientId, use OpenSlotDetails)

key-decisions:
  - "Post-query canceller exclusion added as belt-and-suspenders (DB filter is primary, app filter is safety net)"
  - "Deduplication keeps farthest-out appointment per patient: maximizes appointmentDistance score"
  - "No-show stats fetched only after deduplication to minimize query size"
  - "Default limit is 50 (not 10 as in old code) per SLOT-01 spec"
  - "send-offer.ts waitlist_entries update block removed — appointment-based candidates have no waitlist entry to update"

patterns-established:
  - "findCandidates: three-phase pattern — DB query, post-query filter, score+rank"
  - "AppointmentRow interface: define typed shape for Supabase untyped results before processing"
  - "Two-layer exclusion: DB-level filter (performance) + post-query filter (correctness)"

requirements-completed: [SLOT-01, SLOT-02]

# Metrics
duration: 15min
completed: 2026-03-04
---

# Phase 4 Plan 2: Candidate Detection Summary

**findCandidates rewritten to query appointments table with 5-filter pipeline (canceller exclusion, 24hr cooldown, time-conflict, dedup, 2hr lead time) and 2-factor scoring via computeCandidateScore**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-04T14:50:00Z
- **Completed:** 2026-03-04T15:00:00Z
- **Tasks:** 1 (TDD: RED + GREEN phases, REFACTOR minimal)
- **Files modified:** 5

## Accomplishments

- Completely replaced waitlist_entries-based query with appointments table query
- All 10 findCandidates tests pass (TDD RED → GREEN); 8 scoring tests still pass
- OpenSlotDetails interface with cancellingPatientId field (required for SLOT-01 self-exclusion)
- RankedCandidate interface with candidateAppointmentId and candidateScore (replacing waitlistEntryId/smartScore)
- Fixed send-offer.ts and trigger-backfill.ts to use new API (Rule 1 auto-fix)

## Task Commits

TDD cycle committed atomically:

1. **RED: Failing tests for appointment-based detection** - `b395091` (test)
2. **GREEN: Rewrite find-candidates.ts + fix callers** - `a74547c` (feat)

_REFACTOR: no additional commit needed — code is clean and immutable patterns already used_

## Files Created/Modified

- `src/lib/backfill/__tests__/find-candidates.test.ts` - 10 real tests covering all SLOT-01/SLOT-02 behaviors (replaced todo stubs)
- `src/lib/backfill/__tests__/helpers.ts` - Class-based MockQueryBuilder with proper instance isolation
- `src/lib/backfill/find-candidates.ts` - Complete rewrite: OpenSlotDetails, RankedCandidate, appointments query, 5-filter pipeline, scoring
- `src/lib/backfill/send-offer.ts` - Updated to use candidateAppointmentId + candidateScore; removed waitlist_entries update block
- `src/lib/backfill/trigger-backfill.ts` - Updated to pass cancellingPatientId, use OpenSlotDetails without service/location fields

## Decisions Made

- Added post-query canceller exclusion as a safety net — the DB-level `.neq()` filter is the primary exclusion (performance), but since the mock in tests doesn't apply filters, a post-query check ensures correctness in all environments.
- `deduplicateByPatient` keeps the farthest-out appointment (highest `scheduled_at`) because it maximizes the `appointmentDistance` component of the score, which is the primary ranking factor.
- No-show stats are fetched in a second query AFTER deduplication to minimize the `IN` clause size — only fetching stats for patients who actually survive all filters.
- Removed the `waitlist_entries` update block from `send-offer.ts` — appointment-based candidates don't have a waitlist entry to mark as `offer_pending`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed send-offer.ts broken by new RankedCandidate interface**
- **Found during:** GREEN phase (TypeScript check)
- **Issue:** `send-offer.ts` referenced `candidate.waitlistEntryId` and `candidate.smartScore` which no longer exist on `RankedCandidate`
- **Fix:** Updated to use `candidateAppointmentId` and `candidateScore`; removed `waitlist_entries` update block (no longer applicable); set `waitlist_entry_id: null` in insert
- **Files modified:** `src/lib/backfill/send-offer.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** a74547c (GREEN phase commit)

**2. [Rule 1 - Bug] Fixed trigger-backfill.ts broken by new OpenSlotDetails interface**
- **Found during:** GREEN phase (TypeScript check)
- **Issue:** `trigger-backfill.ts` passed `serviceName`, `serviceCode`, `providerName`, `locationName`, `paymentCategory` to `findCandidates` — fields removed from `OpenSlotDetails`
- **Fix:** Updated to pass `cancellingPatientId: appointment.patient_id` and only the fields that exist in `OpenSlotDetails`
- **Files modified:** `src/lib/backfill/trigger-backfill.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** a74547c (GREEN phase commit)

**3. [Rule 3 - Blocking] Added `AppointmentRow` typed interface for Supabase untyped query results**
- **Found during:** GREEN phase (TypeScript check)
- **Issue:** `appt.id` was typed as `unknown` because the index signature `[key: string]: unknown` in `deduplicateByPatient` lost the specific `id: string` type
- **Fix:** Defined `AppointmentRow` interface with all required fields; cast Supabase result to `AppointmentRow[]`
- **Files modified:** `src/lib/backfill/find-candidates.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** a74547c (GREEN phase commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 broken callers, 1 Rule 3 type error)
**Impact on plan:** All auto-fixes necessary for correctness — they fix callers that broke when the plan required replacing the old API. No scope creep.

## Issues Encountered

- `helpers.ts` was reverted to original stubs version by a concurrent process between the Edit tool call and git staging — resolved by re-writing the file using the Write tool after reading it
- The previous plan's (04-01) test files existed on disk but were uncommitted; discovered via git log inspection, confirmed files were already committed in an earlier session

## Next Phase Readiness

- Plan 03 (trigger-backfill.ts tests and full integration) can begin immediately
- `findCandidates` exports `OpenSlotDetails` and `RankedCandidate` — all types are in place
- 5 trigger-backfill todo stubs are ready for Plan 03 implementation
- `npx vitest run` passes with 18 tests (10 find-candidates + 8 scoring), 5 todos, 0 failures
- `npx tsc --noEmit` compiles cleanly

## Self-Check: PASSED

All 5 modified files verified present on disk.
Both task commits (b395091, a74547c) confirmed in git log.

---
*Phase: 04-candidate-detection*
*Completed: 2026-03-04*
