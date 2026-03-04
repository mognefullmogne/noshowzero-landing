# Phase 4: Candidate Detection - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

When a patient cancels or no-shows, the system automatically identifies all viable replacement candidates from scheduled patients and ranks them by AI priority. This phase produces a ranked candidate list stored in the database — the WhatsApp cascade (sending offers) is Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Candidate Eligibility
- Any scheduled patient with a future appointment is a candidate — no service type restriction
- No provider restriction — any patient can be offered the slot regardless of their original provider
- Cast the widest net: any future appointment qualifies, not just same week
- Candidates must have an appointment AFTER the open slot (moving them earlier is the value)

### Priority Ranking
- Primary factor: how far out the patient's appointment is — patients waiting longest get priority (they benefit most from an earlier slot)
- Secondary factor: reliability history (no-show rate) — used as tiebreaker when appointment distances are similar
- Patients with good show-up history rank higher among similar-distance candidates

### Exclusion Rules
- 24-hour cooldown after a patient declines an offer — don't re-offer for 24 hours
- Exclude only for same-slot decline is NOT enough — 24-hour global cooldown chosen
- Unconfirmed patients ARE eligible — they might jump at an earlier slot
- Same-day patients ARE eligible — ranking handles prioritization
- No daily offer limit beyond the 24-hour decline cooldown
- Patients whose existing appointment would conflict with the open slot (same time) are excluded

### Claude's Discretion
- Minimum lead time before open slot (how close to slot time is too late to offer)
- AI-enhanced vs purely algorithmic ranking — choose based on available data and cost/speed tradeoff
- Candidate list cap — pick a reasonable maximum based on typical clinic sizes
- Exact scoring formula weights for time-to-appointment and reliability components

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/backfill/trigger-backfill.ts`: Orchestrator already called from 4 places on cancellation/no-show — needs rewiring, not rewriting
- `src/lib/backfill/find-candidates.ts`: Queries `waitlist_entries` (always empty) — must be rewritten to query `appointments` table instead
- `src/lib/scoring/waitlist-score.ts`: 0-100 scoring with 7 components — needs adaptation since scheduled appointments lack `clinical_urgency`, `distance_km`, `preferred_time_slots`
- `src/lib/scoring/ai-risk-score.ts`: Claude Haiku integration for patient analysis — could be repurposed for candidate ranking
- `src/lib/scoring/risk-score.ts`: Deterministic risk score fallback — reliability data source

### Established Patterns
- Supabase service client for server-side queries with RLS bypass
- Immutable return types (`readonly` arrays/objects) throughout backfill code
- Fire-and-forget pattern: `triggerBackfill` is called without awaiting in the PATCH handler (`.then()`)
- 10-second target for candidate detection from success criteria

### Integration Points
- `src/app/api/appointments/[id]/route.ts:149` — PATCH handler calls `triggerBackfill` on cancellation (already wired)
- `src/lib/ai/tools/cancel-appointment.ts:30` — AI tool cancellation path (already wired)
- `src/app/api/cron/check-timeouts/route.ts:54` — Timeout cron cascades to next candidate (already wired)
- `src/lib/backfill/process-response.ts:171` — Decline response cascades (already wired)
- `waitlist_offers` table stores offer state — needs to work with new candidate source

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key insight: the trigger points are already wired, the scoring framework exists. The core change is replacing the `waitlist_entries` query in `find-candidates.ts` with a query against the `appointments` table.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-candidate-detection*
*Context gathered: 2026-03-04*
