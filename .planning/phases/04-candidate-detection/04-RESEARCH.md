# Phase 4: Candidate Detection - Research

**Researched:** 2026-03-04
**Domain:** Server-side candidate detection and scoring for appointment slot recovery
**Confidence:** HIGH

## Summary

Phase 4 replaces the existing waitlist-based candidate detection system with an appointment-based one. The core change is surgical: `find-candidates.ts` currently queries the `waitlist_entries` table (which is always empty per CONTEXT.md) and must be rewritten to query the `appointments` table instead. The scoring system in `waitlist-score.ts` must be simplified to use only data available from appointments (wait time and reliability) since appointments lack `clinical_urgency`, `distance_km`, and `preferred_time_slots` fields.

The trigger infrastructure is fully wired -- four call sites already invoke `triggerBackfill()` on cancellation/no-show events. The `waitlist_offers` table schema and the cascade flow (`send-offer.ts`, `process-response.ts`, `expire-offers.ts`) are all functional. The only structural issue is that `waitlist_offers` has a required FK to `waitlist_entries` (`waitlist_entry_id NOT NULL`), which must be made nullable or replaced since candidates will come from appointments, not waitlist entries.

**Primary recommendation:** Rewrite `find-candidates.ts` to query scheduled appointments, create a new simplified scoring function focused on time-to-appointment and reliability, update `RankedCandidate` interface to reference appointments instead of waitlist entries, and add a migration to make `waitlist_entry_id` nullable in `waitlist_offers`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Any scheduled patient with a future appointment is a candidate -- no service type restriction
- No provider restriction -- any patient can be offered the slot regardless of their original provider
- Cast the widest net: any future appointment qualifies, not just same week
- Candidates must have an appointment AFTER the open slot (moving them earlier is the value)
- Primary factor: how far out the patient's appointment is -- patients waiting longest get priority (they benefit most from an earlier slot)
- Secondary factor: reliability history (no-show rate) -- used as tiebreaker when appointment distances are similar
- Patients with good show-up history rank higher among similar-distance candidates
- 24-hour cooldown after a patient declines an offer -- don't re-offer for 24 hours
- 24-hour global cooldown chosen (not per-slot)
- Unconfirmed patients ARE eligible -- they might jump at an earlier slot
- Same-day patients ARE eligible -- ranking handles prioritization
- No daily offer limit beyond the 24-hour decline cooldown
- Patients whose existing appointment would conflict with the open slot (same time) are excluded

### Claude's Discretion
- Minimum lead time before open slot (how close to slot time is too late to offer)
- AI-enhanced vs purely algorithmic ranking -- choose based on available data and cost/speed tradeoff
- Candidate list cap -- pick a reasonable maximum based on typical clinic sizes
- Exact scoring formula weights for time-to-appointment and reliability components

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SLOT-01 | When a patient cancels or no-shows, the system automatically identifies candidate patients from all future scheduled appointments | Trigger infrastructure already wired at 4 call sites; `find-candidates.ts` rewrite to query appointments table; 24hr decline cooldown exclusion; conflict exclusion |
| SLOT-02 | Candidates are ranked by AI priority score (clinical urgency, wait time, proximity to cancelled slot, reliability history) | New `computeCandidateScore()` function using appointment distance as primary factor (0-60) and reliability as secondary (0-40); purely algorithmic approach recommended over AI call for speed |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.98.0 | Database queries and service client | Already in use; RLS bypass via service role key for server-side operations |
| zod | ^4.3.6 | Input validation | Already in use for all schema validation in the project |
| TypeScript | ^5 | Type safety | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next | 16.1.6 | API routes | Existing trigger points are Next.js API handlers |
| crypto (node) | built-in | HMAC tokens | Already used in `offer-tokens.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Purely algorithmic scoring | Claude Haiku AI scoring (existing `ai-risk-score.ts` pattern) | AI adds ~500ms latency + cost per call. With only 2 factors (distance + reliability), algorithmic is deterministic, free, and fast. AI scoring has no advantage when input data is this simple. |
| Supabase query filtering | PostgreSQL function (RPC) | RPC is faster for complex filtering but adds migration complexity. Supabase JS queries are sufficient for the expected data volume (<200 appointments per tenant). |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/lib/backfill/
  find-candidates.ts      # REWRITE: query appointments table, not waitlist_entries
  trigger-backfill.ts     # MODIFY: remove serviceName/serviceCode params, update candidate interface
  send-offer.ts           # MODIFY: update RankedCandidate references (waitlistEntryId -> appointmentId)
  process-response.ts     # MODIFY: on accept, cancel candidate's original appointment (not waitlist entry)
  expire-offers.ts        # MODIFY: remove waitlist_entry references
  offer-tokens.ts         # NO CHANGE
src/lib/scoring/
  candidate-score.ts      # NEW: simplified 0-100 scoring with 2 factors
  waitlist-score.ts       # KEEP: untouched (legacy, used by any remaining waitlist code)
  risk-score.ts           # NO CHANGE (reliability data source)
  ai-risk-score.ts        # NO CHANGE (not used for candidate scoring)
src/lib/types.ts          # MODIFY: add CandidateScoreBreakdown, update RankedCandidate
supabase/migrations/
  012_candidate_detection.sql  # NEW: make waitlist_entry_id nullable, add decline_cooldown index
```

### Pattern 1: Appointment-Based Candidate Query
**What:** Query all scheduled future appointments for the tenant, exclude conflicts and recently-declined patients, then score and rank.
**When to use:** Every time `findCandidates()` is called (on cancellation, decline cascade, timeout cascade).
**Example:**
```typescript
// Query: all future scheduled appointments for this tenant
// excluding: the cancelling patient, conflicting times, 24hr decline cooldown
const { data: candidates } = await supabase
  .from("appointments")
  .select("*, patient:patients(id, first_name, last_name, phone, email, preferred_channel)")
  .eq("tenant_id", tenantId)
  .in("status", ["scheduled", "reminder_pending", "reminder_sent", "confirmed"])
  .gt("scheduled_at", openSlotTime.toISOString())  // appointment AFTER the open slot
  .neq("patient_id", cancellingPatientId)           // exclude the cancelling patient
  .limit(200);

// Post-query filters that can't be done in Supabase query:
// 1. Exclude patients with a decline in last 24 hours
// 2. Exclude patients whose appointment conflicts with open slot time
// 3. Score and rank remaining candidates
```

### Pattern 2: Immutable Scoring Function
**What:** Pure function that takes appointment data and returns a score breakdown.
**When to use:** Scoring each candidate.
**Example:**
```typescript
interface CandidateScoreInput {
  readonly appointmentScheduledAt: Date;  // candidate's current appointment time
  readonly openSlotAt: Date;              // the cancelled slot time
  readonly patientNoShows: number;
  readonly patientTotal: number;
}

interface CandidateScoreBreakdown {
  readonly total: number;        // 0-100
  readonly appointmentDistance: number;  // 0-60 (primary)
  readonly reliability: number;         // 0-40 (secondary)
}

function computeCandidateScore(input: CandidateScoreInput): CandidateScoreBreakdown {
  // appointmentDistance: farther out = higher score (those patients benefit most)
  const daysUntilAppt = Math.max(0,
    (input.appointmentScheduledAt.getTime() - input.openSlotAt.getTime()) / 86_400_000
  );
  // Scale: 0-7 days=10, 7-14=20, 14-30=35, 30-60=45, 60+=60
  const appointmentDistance = daysUntilAppt >= 60 ? 60
    : daysUntilAppt >= 30 ? 45
    : daysUntilAppt >= 14 ? 35
    : daysUntilAppt >= 7 ? 20
    : 10;

  // reliability: higher show rate = higher score
  const reliability = input.patientTotal < 2
    ? 20  // neutral for new patients
    : Math.round((1 - input.patientNoShows / input.patientTotal) * 40);

  return {
    total: appointmentDistance + reliability,
    appointmentDistance,
    reliability,
  };
}
```

### Pattern 3: 24-Hour Decline Cooldown Check
**What:** Before scoring, exclude any patient who declined an offer within the last 24 hours.
**When to use:** During candidate filtering.
**Example:**
```typescript
// Query recent declines (last 24 hours)
const cooldownCutoff = new Date(Date.now() - 24 * 3_600_000).toISOString();
const { data: recentDeclines } = await supabase
  .from("waitlist_offers")
  .select("patient_id")
  .eq("tenant_id", tenantId)
  .eq("status", "declined")
  .gte("responded_at", cooldownCutoff);

const declinedPatientIds = new Set(recentDeclines?.map(d => d.patient_id) ?? []);
// Filter out declined patients from candidates
```

### Anti-Patterns to Avoid
- **Mutating the scoring function inputs:** Always compute new score objects, never modify input data. The codebase follows immutable patterns throughout.
- **Querying waitlist_entries for candidates:** The old approach -- waitlist_entries is always empty. All candidates come from the appointments table now.
- **Blocking the PATCH response on candidate detection:** The existing fire-and-forget pattern (`.then()`) is correct -- never `await triggerBackfill()` in the request handler. The API response must return immediately.
- **Calling AI for candidate scoring:** With only 2 input factors (distance and reliability), an AI call adds latency and cost with zero benefit. The deterministic formula is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC token generation | Custom crypto code | Existing `offer-tokens.ts` | Already battle-tested with timing-safe comparison |
| Service client creation | Manual Supabase init | Existing `createServiceClient()` | Handles env vars, consistent with codebase |
| Appointment status transitions | Ad-hoc status checks | Existing `VALID_TRANSITIONS` map | Prevents invalid state transitions |
| WhatsApp message sending | Direct Twilio API calls | Existing `sendNotification()` | Handles demo tenant phone override, statusCallback |

**Key insight:** The heavy lifting infrastructure (triggers, offers table, cascade flow, WhatsApp delivery) all exists. This phase is about rewiring the candidate source and simplifying the scoring -- not building new infrastructure.

## Common Pitfalls

### Pitfall 1: waitlist_offers.waitlist_entry_id NOT NULL Constraint
**What goes wrong:** The `waitlist_offers` table requires a `waitlist_entry_id` FK. Since candidates now come from appointments (not waitlist entries), inserts to `waitlist_offers` will fail with a NOT NULL violation.
**Why it happens:** The original schema assumed candidates always come from the waitlist.
**How to avoid:** Add migration 012 to make `waitlist_entry_id` nullable AND add a new `candidate_appointment_id` column (UUID FK to appointments) to track which appointment the candidate is being moved from.
**Warning signs:** "null value in column waitlist_entry_id violates not-null constraint" errors.

### Pitfall 2: Self-Referential Candidate (Cancelling Patient Offered Their Own Slot)
**What goes wrong:** The patient who just cancelled could be offered back their own cancelled slot if they have another future appointment.
**Why it happens:** The query finds all patients with future appointments -- including the one who just cancelled.
**How to avoid:** Always exclude `cancellingPatientId` from the candidate query. The PATCH handler already has the patient_id from the appointment record.
**Warning signs:** Same patient receives an offer for a slot they just vacated.

### Pitfall 3: Race Condition on Concurrent Cancellations
**What goes wrong:** Two appointments cancel simultaneously, both find the same candidate as #1, both send offers.
**Why it happens:** Fire-and-forget pattern means no locking between concurrent `triggerBackfill()` calls.
**How to avoid:** The existing pattern in `send-offer.ts` handles this -- `waitlist_offers` insert will succeed for the first, and the `triggerBackfill` check for "existing pending offer" prevents double-offering for the same slot. For different slots, a patient receiving two offers simultaneously is acceptable (they can accept whichever they prefer).
**Warning signs:** Same patient receiving offers for the SAME slot (not different slots).

### Pitfall 4: Time Conflict Detection
**What goes wrong:** A candidate is offered a slot that overlaps with their existing appointment.
**Why it happens:** Simple time equality check misses overlapping appointments (e.g., existing 10:00-10:30, offered slot 10:15-10:45).
**How to avoid:** Check for time RANGE overlap, not exact time match. A candidate's existing appointment at time X with duration D conflicts with the open slot at time Y with duration E if: X < Y + E AND Y < X + D.
**Warning signs:** Patient accepts a slot but now has two overlapping appointments.

### Pitfall 5: Candidate's Original Appointment Not Freed on Accept
**What goes wrong:** When a candidate accepts the offer, their original appointment isn't cancelled or freed, so the calendar shows them double-booked.
**Why it happens:** The current `processAccept()` only creates a new appointment and marks the waitlist entry as fulfilled. With the new appointment-based system, the candidate's original appointment must also be handled.
**How to avoid:** In Phase 5 (WhatsApp Cascade), `processAccept()` must cancel the candidate's original appointment and trigger a new backfill cascade for THAT slot. Phase 4 needs to store the candidate's appointment ID so Phase 5 can reference it.
**Warning signs:** Double-booked patients, unreleased slots.

### Pitfall 6: Performance with Large Appointment Tables
**What goes wrong:** Querying all future appointments for a tenant with thousands of appointments is slow, exceeding the 10-second target.
**Why it happens:** No index on `(tenant_id, status, scheduled_at)` composite.
**How to avoid:** The existing index `idx_appointments_status` covers `(tenant_id, status)` and `idx_appointments_scheduled` covers `(tenant_id, scheduled_at)`. These should be sufficient for <10k appointments. For the candidate query, limit to 200 results -- a clinic will never need to cascade through more than ~50 candidates for a single slot.
**Warning signs:** `findCandidates()` exceeding 5 seconds on larger tenants.

## Code Examples

### Updated RankedCandidate Interface
```typescript
// Source: derived from existing find-candidates.ts + CONTEXT.md decisions
export interface RankedCandidate {
  readonly candidateAppointmentId: string;  // the appointment being moved earlier
  readonly patientId: string;
  readonly patientName: string;
  readonly patientPhone: string | null;
  readonly patientEmail: string | null;
  readonly preferredChannel: "whatsapp" | "sms" | "email";
  readonly candidateScore: CandidateScoreBreakdown;
  readonly currentAppointmentAt: Date;  // when their existing appointment is
}
```

### Updated findCandidates Function Signature
```typescript
// Source: refactored from existing find-candidates.ts
interface OpenSlotDetails {
  readonly appointmentId: string;       // the cancelled appointment
  readonly tenantId: string;
  readonly cancellingPatientId: string;  // NEW: to exclude self-referential candidates
  readonly scheduledAt: Date;           // the slot's time
  readonly durationMin: number;         // for conflict detection
}

export async function findCandidates(
  supabase: SupabaseClient,
  slot: OpenSlotDetails,
  limit: number = 50
): Promise<readonly RankedCandidate[]>
```

### Database Migration (012_candidate_detection.sql)
```sql
-- Make waitlist_entry_id nullable (candidates now come from appointments)
ALTER TABLE waitlist_offers
  ALTER COLUMN waitlist_entry_id DROP NOT NULL;

-- Add reference to the candidate's current appointment
ALTER TABLE waitlist_offers
  ADD COLUMN candidate_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;

-- Index for 24-hour decline cooldown queries
CREATE INDEX idx_waitlist_offers_declined_recent
  ON waitlist_offers(tenant_id, patient_id, responded_at)
  WHERE status = 'declined';

-- Index for candidate query: future scheduled appointments
CREATE INDEX idx_appointments_candidate_lookup
  ON appointments(tenant_id, status, scheduled_at)
  WHERE status IN ('scheduled', 'reminder_pending', 'reminder_sent', 'confirmed');
```

### Conflict Detection Helper
```typescript
// Source: standard time range overlap logic
function hasTimeConflict(
  candidateStart: Date,
  candidateDurationMin: number,
  slotStart: Date,
  slotDurationMin: number
): boolean {
  const candidateEnd = new Date(candidateStart.getTime() + candidateDurationMin * 60_000);
  const slotEnd = new Date(slotStart.getTime() + slotDurationMin * 60_000);
  return candidateStart < slotEnd && slotStart < candidateEnd;
}
```

## Discretion Recommendations

### Minimum Lead Time Before Open Slot
**Recommendation:** 2 hours minimum lead time.
**Rationale:** Offering a slot that starts in 30 minutes is unrealistic -- the patient needs time to see the message, rearrange their schedule, and travel. 2 hours provides a reasonable window while not excluding too many slots. Implemented as a simple check: `if slot.scheduledAt - now < 2 hours, skip detection`.

### AI-Enhanced vs Purely Algorithmic Ranking
**Recommendation:** Purely algorithmic.
**Rationale:** The two ranking factors (appointment distance and reliability) are both numeric and deterministic. AI scoring via Claude Haiku (as in `ai-risk-score.ts`) adds ~300-800ms latency per candidate and costs per API call. With 50 candidates, that's 15-40 seconds of AI calls alone -- exceeding the 10-second budget. The algorithmic approach processes 50 candidates in <10ms.

### Candidate List Cap
**Recommendation:** 50 candidates maximum.
**Rationale:** The demo tenant has 19 patients (typical small clinic). Even a large clinic with 500 patients would have maybe 100-200 future appointments at any time. Querying 200 and scoring/ranking the top 50 is well within the 10-second target. The cascade will realistically never reach candidate #50 -- most slots fill within the first 3-5 offers.

### Scoring Formula Weights
**Recommendation:** Appointment distance 0-60 (primary), Reliability 0-40 (secondary).
**Rationale:** The user explicitly stated appointment distance is the primary factor with reliability as a tiebreaker. The 60/40 split ensures that a patient with an appointment 2 months out always ranks above a patient 1 week out, regardless of reliability. Within the same distance band, reliability breaks ties (e.g., both have appointments 3 weeks out, but one has 0% no-show rate vs 20%).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Query `waitlist_entries` for candidates | Query `appointments` for candidates | Phase 4 (this phase) | Waitlist entries are always empty; appointments have real data |
| 7-factor scoring (urgency, reliability, time pref, wait time, distance, provider, payment) | 2-factor scoring (appointment distance, reliability) | Phase 4 (this phase) | Simpler, faster, maps to available data |
| Waitlist-entry-based cascade | Appointment-based cascade | Phase 4 (this phase) | `waitlist_entry_id` becomes optional in `waitlist_offers` |

**Deprecated/outdated:**
- `waitlist_entries` table: Still exists but no longer used as candidate source. May be removed in a future cleanup phase.
- `computeWaitlistScore()`: Retained for backward compatibility but not called from the new candidate detection flow.

## Open Questions

1. **Should the candidate's original appointment be cancelled on accept in Phase 4, or deferred to Phase 5?**
   - What we know: Phase 5 handles the WhatsApp cascade including accept/decline. Phase 4 only produces the ranked candidate list.
   - What's unclear: Whether Phase 4 needs to store enough data for Phase 5 to cancel the original appointment.
   - Recommendation: Phase 4 stores `candidate_appointment_id` in the offer record. Phase 5 uses it to cancel the original appointment on accept. This keeps Phase 4 focused on detection and Phase 5 on the cascade lifecycle.

2. **How to handle patients with multiple future appointments?**
   - What we know: A patient could have 3 appointments next week. Each is a valid candidate entry.
   - What's unclear: Should we offer the slot to the same patient multiple times (once per appointment), or once per patient (using their farthest-out appointment)?
   - Recommendation: One entry per patient, using their farthest-out appointment (maximizes the "moving earlier" value). Deduplicate by `patient_id` after querying, keeping the appointment with the latest `scheduled_at`.

3. **Interaction with the cron timeout path**
   - What we know: `check-timeouts/route.ts` marks confirmation-timeout appointments and triggers backfill. But timeout status doesn't change to `cancelled` or `no_show` -- it stays as `timeout`.
   - What's unclear: Should `timeout` status appointments trigger candidate detection? Currently `triggerBackfill` checks for `cancelled` or `no_show` only.
   - Recommendation: Leave as-is for Phase 4. Timeout means the patient didn't confirm, but the appointment still exists. Adding timeout to candidate detection scope could be a Phase 5+ enhancement.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed -- needs Wave 0 setup |
| Config file | none -- see Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` (after setup) |
| Full suite command | `npx vitest run` (after setup) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SLOT-01 | Cancellation triggers candidate list from appointments | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -x` | Wave 0 |
| SLOT-01 | Excludes cancelling patient from candidates | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -t "excludes cancelling patient" -x` | Wave 0 |
| SLOT-01 | Excludes patients in 24hr decline cooldown | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -t "24hr cooldown" -x` | Wave 0 |
| SLOT-01 | Excludes time-conflicting appointments | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -t "conflict" -x` | Wave 0 |
| SLOT-01 | Only includes appointments AFTER the open slot | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -t "after open slot" -x` | Wave 0 |
| SLOT-02 | Scores by appointment distance (primary) | unit | `npx vitest run src/lib/scoring/__tests__/candidate-score.test.ts -t "distance" -x` | Wave 0 |
| SLOT-02 | Scores by reliability (secondary) | unit | `npx vitest run src/lib/scoring/__tests__/candidate-score.test.ts -t "reliability" -x` | Wave 0 |
| SLOT-02 | Ranks candidates correctly (distance primary, reliability tiebreaker) | unit | `npx vitest run src/lib/scoring/__tests__/candidate-score.test.ts -t "ranking" -x` | Wave 0 |
| SLOT-02 | Deduplicates by patient (keeps farthest appointment) | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -t "dedup" -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Install vitest: `npm install -D vitest`
- [ ] Create `vitest.config.ts` with path aliases matching tsconfig
- [ ] Add `"test": "vitest run"` to package.json scripts
- [ ] `src/lib/backfill/__tests__/find-candidates.test.ts` -- covers SLOT-01
- [ ] `src/lib/scoring/__tests__/candidate-score.test.ts` -- covers SLOT-02
- [ ] `src/lib/backfill/__tests__/trigger-backfill.test.ts` -- covers orchestration
- [ ] Test helpers: Supabase mock factory for unit tests

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/backfill/*.ts` (6 files), `src/lib/scoring/*.ts` (3 files), `src/lib/types.ts`, `src/app/api/appointments/[id]/route.ts`
- Database schema: `supabase/migrations/002_product_tables.sql` (appointments, waitlist_entries), `supabase/migrations/003_waitlist_offers.sql` (offers table)
- Phase context: `.planning/phases/04-candidate-detection/04-CONTEXT.md` (user decisions)
- Project state: `.planning/STATE.md`, `.planning/REQUIREMENTS.md`

### Secondary (MEDIUM confidence)
- Scoring formula weights (60/40 split): Based on user's "primary/secondary" guidance and analysis of the existing 7-component scoring system's relative weights

### Tertiary (LOW confidence)
- Performance estimates (10ms for 50 candidates, <200 appointments per small clinic): Based on general Supabase query performance knowledge; not benchmarked against this specific deployment

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; all existing dependencies are well-understood from codebase analysis
- Architecture: HIGH - Surgical refactor of existing files with clear patterns; migration is straightforward
- Pitfalls: HIGH - Identified from direct code inspection (NOT NULL constraint, self-referential bug, conflict detection)
- Scoring formula: MEDIUM - Weights are reasonable but exact thresholds (7/14/30/60 day bands) may need tuning after real-world testing

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable domain, no external dependency changes expected)
