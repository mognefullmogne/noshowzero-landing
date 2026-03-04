---
phase: 04-candidate-detection
verified: 2026-03-04T15:10:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 4: Candidate Detection Verification Report

**Phase Goal:** Auto-detect candidates from scheduled patients, score and rank them
**Verified:** 2026-03-04T15:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Cancellation triggers candidate list from scheduled appointments, not waitlist_entries | VERIFIED | `find-candidates.ts` queries `appointments` table via `.from("appointments")` — no `waitlist_entries` reference in query code |
| 2 | Cancelling patient is excluded from the candidate list | VERIFIED | DB-level `.neq("patient_id", slot.cancellingPatientId)` plus post-query belt-and-suspenders filter; test "excludes the cancelling patient" passes |
| 3 | Patients who declined any offer in the last 24 hours are excluded | VERIFIED | Queries `waitlist_offers` for `status=declined` + `responded_at >= 24h ago`; builds `declinedPatientIds` Set for O(1) lookup; test passes |
| 4 | Patients whose existing appointment time-conflicts with the open slot are excluded | VERIFIED | `hasTimeConflict()` function implements half-open interval overlap; test "excludes time-conflicting appointments" passes |
| 5 | Only appointments scheduled AFTER the open slot are considered | VERIFIED | DB-level `.gt("scheduled_at", slot.scheduledAt.toISOString())` plus post-query double-check; test "only includes appointments AFTER the open slot" passes |
| 6 | Patients with multiple future appointments appear once (farthest-out appointment kept) | VERIFIED | `deduplicateByPatient()` keeps highest `scheduled_at`; test "deduplicates by patient, keeping farthest-out" passes |
| 7 | Candidates are ranked by computeCandidateScore descending | VERIFIED | `sorted = [...scored].sort((a, b) => b.candidateScore.total - a.candidateScore.total)`; test "ranks by candidate score descending" passes |
| 8 | Minimum 2-hour lead time before the open slot | VERIFIED | Guard: `slot.scheduledAt.getTime() - now.getTime() < MIN_LEAD_TIME_MS` returns `[]`; test "returns empty array when slot is in the past" passes |
| 9 | Maximum 50 candidates returned | VERIFIED | Default `limit = 50`, `sorted.slice(0, limit)`; test "caps results at the limit parameter" passes |
| 10 | triggerBackfill passes cancellingPatientId to findCandidates for self-exclusion | VERIFIED | `cancellingPatientId: appointment.patient_id` in OpenSlotDetails literal; test asserts value equals appointment's patient_id |
| 11 | triggerBackfill does NOT pass old service/location/payment fields to findCandidates | VERIFIED | `findCandidates` call has only 5 fields (appointmentId, tenantId, cancellingPatientId, scheduledAt, durationMin); test asserts serviceName/serviceCode/providerName/locationName/paymentCategory are undefined on slot |
| 12 | sendOffer inserts candidate_appointment_id into waitlist_offers (not waitlist_entry_id) | VERIFIED | `waitlist_entry_id: null`, `candidate_appointment_id: input.candidate.candidateAppointmentId` in insert; confirmed in send-offer.ts line 53-54 |
| 13 | sendOffer does not attempt to update waitlist_entries on offer send | VERIFIED | No reference to `waitlist_entries` table in send-offer.ts; the old update block was removed |
| 14 | 2-factor scoring algorithm produces correct results for all distance bands and reliability cases | VERIFIED | 8 scoring tests all pass covering: 0-7d=10, 7-14d=20, 14-30d=35, 30-60d=45, 60+d=60 bands; 0% no-show=40, <2 appts=20 neutral, 50% no-show=20 |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vitest.config.ts` | Test framework with @/ path alias | VERIFIED | Exists, 14 lines, exports `defineConfig` with `resolve.alias` mapping `@` to `./src`; `__dirname` used for absolute path |
| `src/lib/types.ts` | CandidateScoreBreakdown interface and updated WaitlistOffer | VERIFIED | `CandidateScoreBreakdown` at line 128; `WaitlistOffer.waitlist_entry_id: string | null` at line 142; `candidate_appointment_id: string | null` at line 143 |
| `src/lib/scoring/candidate-score.ts` | Pure scoring function with 2-factor algorithm | VERIFIED | 51 lines, exports `computeCandidateScore` and `CandidateScoreInput`; uses `Object.freeze()` on return value; imports `CandidateScoreBreakdown` from `@/lib/types` |
| `src/lib/backfill/find-candidates.ts` | Appointment-based candidate detection | VERIFIED | 237 lines, exports `findCandidates`, `OpenSlotDetails`, `RankedCandidate`; complete 5-filter pipeline with deduplication and scoring |
| `src/lib/backfill/__tests__/find-candidates.test.ts` | 10 real tests covering all SLOT-01 behaviors | VERIFIED | 312 lines, 10 real tests (no `it.todo()`), all pass |
| `src/lib/scoring/__tests__/candidate-score.test.ts` | 8 scoring tests | VERIFIED | 119 lines, 8 real tests, all pass |
| `src/lib/backfill/__tests__/trigger-backfill.test.ts` | 5 tests for orchestrator wiring | VERIFIED | 210 lines, 5 real tests using `vi.mock`, all pass |
| `src/lib/backfill/__tests__/helpers.ts` | createMockSupabase factory | VERIFIED | 125 lines, class-based `MockQueryBuilder` implementing full chaining API, typed as `SupabaseClient` |
| `supabase/migrations/012_candidate_detection.sql` | Schema changes for appointment-based candidates | VERIFIED | Contains `ALTER COLUMN waitlist_entry_id DROP NOT NULL`, `ADD COLUMN candidate_appointment_id UUID`, and 2 performance indexes |
| `src/lib/backfill/trigger-backfill.ts` | Updated orchestrator using OpenSlotDetails | VERIFIED | 103 lines, passes `cancellingPatientId: appointment.patient_id`; no old service/location fields in findCandidates call |
| `src/lib/backfill/send-offer.ts` | Updated with candidateAppointmentId, no waitlist_entries update | VERIFIED | 188 lines, `waitlist_entry_id: null`, `candidate_appointment_id: input.candidate.candidateAppointmentId`; no waitlist_entries table reference |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `vitest.config.ts` | `tsconfig.json` | `@/` path alias `resolve` block | VERIFIED | `alias: { "@": resolve(__dirname, "./src") }` mirrors tsconfig `"@/*": ["./src/*"]` |
| `src/lib/scoring/candidate-score.ts` | `src/lib/types.ts` | `import { CandidateScoreBreakdown }` | VERIFIED | Line 1: `import { CandidateScoreBreakdown } from "@/lib/types"` |
| `src/lib/backfill/find-candidates.ts` | `src/lib/scoring/candidate-score.ts` | `import { computeCandidateScore }` | VERIFIED | Line 14: `import { computeCandidateScore } from "@/lib/scoring/candidate-score"` |
| `src/lib/backfill/find-candidates.ts` | `src/lib/types.ts` | `CandidateScoreBreakdown` type import | VERIFIED | Line 13: `import type { CandidateScoreBreakdown } from "@/lib/types"` |
| `src/lib/backfill/find-candidates.ts` | Supabase `appointments` table | `.from("appointments")` | VERIFIED | Lines 88-95 and 145-149; two queries to appointments table |
| `src/lib/backfill/find-candidates.ts` | Supabase `waitlist_offers` table | 24hr decline cooldown query | VERIFIED | Lines 108-113: `.from("waitlist_offers").select("patient_id").eq("status","declined").gte("responded_at",...)` |
| `src/lib/backfill/trigger-backfill.ts` | `src/lib/backfill/find-candidates.ts` | `findCandidates` with `cancellingPatientId` | VERIFIED | Lines 60-66: `findCandidates(supabase, { appointmentId, tenantId, cancellingPatientId: appointment.patient_id, scheduledAt, durationMin })` |
| `src/lib/backfill/send-offer.ts` | `src/lib/backfill/find-candidates.ts` | `RankedCandidate` type import | VERIFIED | Line 8: `import type { RankedCandidate } from "./find-candidates"` |
| `src/lib/backfill/send-offer.ts` | Supabase `waitlist_offers` table | `insert` with `candidate_appointment_id` | VERIFIED | Lines 47-61: insert includes `waitlist_entry_id: null` and `candidate_appointment_id: input.candidate.candidateAppointmentId` |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| SLOT-01 | 04-01, 04-02, 04-03 | System automatically identifies candidates from future scheduled appointments when cancellation occurs | SATISFIED | `findCandidates` queries `appointments` table; `triggerBackfill` calls it on cancellation; 10 tests covering all filtering behaviors pass |
| SLOT-02 | 04-01, 04-02, 04-03 | Candidates ranked by AI priority score (proximity to cancelled slot, reliability history) | SATISFIED | `computeCandidateScore` implements 2-factor scoring: `appointmentDistance` (0-60) as primary + `reliability` (0-40) as tiebreaker; 8 tests covering all bands and edge cases pass |

No orphaned requirements: REQUIREMENTS.md maps only SLOT-01 and SLOT-02 to Phase 4, and both are covered by all three plans.

---

### Anti-Patterns Found

No anti-patterns detected. Scan results:

- No `TODO`, `FIXME`, `XXX`, `HACK`, or `PLACEHOLDER` comments in any modified backfill/scoring file
- No `return null` stub pattern (the `return null` in trigger-backfill is legitimate early-exit logic, not a stub)
- No empty handlers or placeholder implementations
- No `it.todo()` stubs remaining — all 23 tests are real assertions

---

### Human Verification Required

None. All phase behaviors are exercised by the automated test suite. The candidate detection pipeline operates purely on data transformations with no visual UI, real-time WebSocket behavior, or external service integration in scope for this phase.

---

### Test Suite Results (Verified Live)

```
Test Files   3 passed (3)
Tests        23 passed (23)
Duration     142ms
```

- `computeCandidateScore` — 8 tests: all passing
- `findCandidates` — 10 tests: all passing
- `triggerBackfill` — 5 tests: all passing

TypeScript: `npx tsc --noEmit` — zero errors.

---

### Commits Verified

All 6 commits referenced in plan summaries exist in git log on `redesign/landing-page`:

| Hash | Type | Description |
|------|------|-------------|
| `51bd7f7` | feat | Install vitest, add CandidateScoreBreakdown types, create scoring function |
| `2cff6e3` | test | Add migration 012, scoring tests, and test stubs |
| `b395091` | test | Add failing tests for appointment-based candidate detection (TDD RED) |
| `a74547c` | feat | Rewrite find-candidates.ts with appointment-based detection (TDD GREEN) |
| `bfc3b3a` | test | Implement trigger-backfill orchestrator tests |
| `a33b122` | fix | Fix type assertion cast in trigger-backfill tests |

---

### Phase Goal Assessment

**Goal:** Candidate Detection — auto-detect candidates from scheduled patients, score and rank them

**Verdict: ACHIEVED.**

The complete pipeline is operational:

1. A cancellation event reaches `triggerBackfill`
2. `triggerBackfill` extracts the cancelling patient's ID and constructs `OpenSlotDetails`
3. `findCandidates` queries the `appointments` table (not `waitlist_entries`) and applies 5 filters: past-slot guard, after-slot-only, canceller exclusion, 24h decline cooldown, time-conflict exclusion
4. Surviving candidates are deduplicated (farthest-out appointment per patient) and scored via `computeCandidateScore`
5. Results are sorted descending by total score and returned as `RankedCandidate[]`
6. `triggerBackfill` passes the top candidate to `sendOffer`, which stores `candidate_appointment_id` (not `waitlist_entry_id`) in the `waitlist_offers` table
7. Migration 012 provides the schema changes required (nullable `waitlist_entry_id`, new `candidate_appointment_id` column, 2 performance indexes)

---

_Verified: 2026-03-04T15:10:00Z_
_Verifier: Claude (gsd-verifier)_
