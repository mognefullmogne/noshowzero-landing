---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Slot Recovery Engine
status: executing
stopped_at: Completed 05-01-PLAN.md
last_updated: "2026-03-04T14:52:16.730Z"
last_activity: 2026-03-04 — Completed 05-01 (Italian reply-based template, 1hr expiry, cascade plumbing)
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 12
  completed_plans: 11
  percent: 92
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** When a patient cancels, the system automatically fills that slot by contacting the best-fit patient via WhatsApp -- no staff intervention, no empty chairs, no lost revenue.
**Current focus:** Phase 5 — WhatsApp Cascade

## Current Position

Phase: 5 of 7 (WhatsApp Cascade)
Plan: 1 of 2 in current phase — 05-01 complete
Status: Executing
Last activity: 2026-03-04 — Completed 05-01 (Italian reply-based template, 1hr expiry, cascade plumbing)

Progress: [█████████░] 92% (11/12 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (from v1.0)
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

### Pending Todos

None yet.

### Blockers/Concerns

- **Single test phone:** All 19 patients share +393516761840 -- cascade testing needs awareness
- **WhatsApp sandbox:** Limited to pre-joined numbers; sandbox can reset and clear webhook URLs
- **Existing backfill code:** Backend logic exists but is not triggered properly; needs rewiring, not rewriting

## Session Continuity

Last session: 2026-03-04T14:52:16.729Z
Stopped at: Completed 05-01-PLAN.md
Resume file: None
