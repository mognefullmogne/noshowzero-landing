---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Slot Recovery Engine
status: executing
stopped_at: Phase 7 context gathered
last_updated: "2026-03-04T16:17:40.512Z"
last_activity: 2026-03-04 — Completed 06-02 (appointment value settings UI, recovery KPI dashboard cards)
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 14
  completed_plans: 14
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** When a patient cancels, the system automatically fills that slot by contacting the best-fit patient via WhatsApp -- no staff intervention, no empty chairs, no lost revenue.
**Current focus:** Phase 6 complete — Revenue Metrics done. Ready for Phase 7.

## Current Position

Phase: 6 of 7 (Revenue Metrics) — COMPLETE
Plan: 2 of 2 in current phase — all complete
Status: Executing
Last activity: 2026-03-04 — Completed 06-02 (appointment value settings UI, recovery KPI dashboard cards)

Progress: [██████████] 100% (14/14 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 14
- Average duration: --
- Total execution time: --

## Accumulated Context

### Decisions

- [v1.0]: Supabase Realtime over Pusher/Ably -- zero additional infrastructure
- [v1.0]: Subscribe-first-then-fetch pattern for race condition prevention
- [v1.0]: RLS-only filtering for tenant scoping on Realtime subscriptions
- [v1.1]: Auto-detect candidates from scheduled patients vs manual waitlist
- [v1.1]: WhatsApp only for slot offers
- [v1.1]: 1-hour timeout per offer before cascade to next candidate
- [v1.1]: Revenue = filled slots + saved no-shows (honest metrics only)
- [v1.1]: Configurable appointment value per tenant
- [Phase 04-candidate-detection]: Two-factor scoring: appointmentDistance (0-60 primary) + reliability (0-40 tiebreaker) for candidate ranking
- [Phase 04-candidate-detection]: New patients (<2 appointments) get neutral reliability score of 20 to avoid penalizing first-timers
- [Phase 04-candidate-detection]: waitlist_entry_id made nullable in WaitlistOffer to support appointment-based candidates
- [Phase 04-02]: Post-query canceller exclusion added as belt-and-suspenders (DB filter primary, app filter safety net)
- [Phase 04-02]: Deduplication keeps farthest-out appointment to maximize appointmentDistance scoring component
- [Phase 04-02]: send-offer.ts waitlist_entries update removed — appointment-based candidates have no entry to update
- [Phase 04-candidate-detection]: Tests confirmed trigger-backfill.ts and send-offer.ts were already correctly updated in 04-02 — no implementation changes needed in 04-03, only test coverage added
- [Phase 05-01]: MAX_OFFERS_PER_SLOT set to 10 — reasonable cap preventing runaway cascades
- [Phase 05-01]: Cascade exhaustion recorded via audit_log insert (dashboard already queries audit_log)
- [Phase 05-01]: WhatsApp template uses SI/NO reply, SMS/email keep URL-based links as fallback
- [Phase 05-01]: Token generation preserved for DB security (token_hash), but URLs omitted from WhatsApp message body
- [Phase 05-02]: Chain cascade is fire-and-forget (.catch()) to avoid blocking accept response
- [Phase 05-02]: Freed appointment uses existing "cancelled" status with descriptive notes ("Freed by slot recovery")
- [Phase 05-02]: AI offer classifier uses narrowed 3-intent schema (accept_offer/decline_offer/unknown) for higher accuracy
- [Phase 05-02]: Clarification prompt returned when AI offer classification confidence below 0.6
- [Phase 05]: Chain cascade is fire-and-forget (.catch()) to avoid blocking accept response
- [Phase 05]: Freed appointment uses existing cancelled status with descriptive notes (Freed by slot recovery)
- [Phase 05]: AI offer classifier uses narrowed 3-intent schema (accept_offer/decline_offer/unknown)
- [Phase 06-01]: Default avg_appointment_value set to EUR 80 matching existing compute-snapshot default
- [Phase 06-01]: Recovery = only accepted offers with new_appointment_id (honest metric per METR-01)
- [Phase 06-01]: Fill rate uses METR-04 formula: slotsRecovered / (cancelled + noShow) x 100
- [Phase 06-01]: Backward-compatible: waitlistFills and revenueSaved response fields preserved with honest values
- [Phase 06]: Used valueAsNumber register option instead of z.coerce.number() for Zod 4 + react-hook-form compatibility
- [Phase 06]: New AnalyticsData fields optional for backward compatibility with older API responses

### Pending Todos

None yet.

### Blockers/Concerns

- **Single test phone:** All 19 patients share +393516761840 -- cascade testing needs awareness
- **WhatsApp sandbox:** Limited to pre-joined numbers; sandbox can reset and clear webhook URLs
- **Existing backfill code:** Backend logic exists but is not triggered properly; needs rewiring, not rewriting

## Session Continuity

Last session: 2026-03-04T16:17:40.510Z
Stopped at: Phase 7 context gathered
Resume file: .planning/phases/07-recovery-dashboard/07-CONTEXT.md
