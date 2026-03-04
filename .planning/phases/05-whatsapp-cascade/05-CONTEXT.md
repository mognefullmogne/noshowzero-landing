# Phase 5: WhatsApp Cascade - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The system contacts candidates one-by-one via WhatsApp until the cancelled slot is filled or all candidates are exhausted. This phase implements the full cascade loop: send offer, handle accept/decline/expire, move to next candidate, and manage appointment state changes on acceptance. Candidate detection (Phase 4) provides the ranked list; this phase consumes it.

Requirements: SLOT-03, SLOT-04, SLOT-05, SLOT-06

</domain>

<decisions>
## Implementation Decisions

### Offer message wording
- Language: Italian only, friendly/informal "tu" form ("Ciao [Nome]!")
- Full context in every offer message: patient name, service name, provider name, location, slot date/time, AND the patient's current appointment date/time for comparison
- Mention the 1-hour time limit explicitly (e.g., "Hai 1 ora per rispondere")
- Accept/decline instructions: "Rispondi SI per accettare o NO per rifiutare"

### Accept/decline mechanism
- Reply-based only — no URL token links in the message. Patient replies in the WhatsApp chat
- Reuse existing keyword classification: "si/si/ok/confermo/yes" = accept_offer, "no/annulla/cancel" = decline_offer (same regex patterns as confirmation flow)
- AI fallback (Claude Haiku) for unclear messages while an active offer exists — classify intent, if still unclear ask to clarify
- Detailed confirmation messages after accept: new appointment details + mention the old appointment is freed
- Detailed confirmation after decline: confirm no change to existing appointment

### Original appointment on accept
- When a candidate accepts, their original (later) appointment is freed (status handling at Claude's discretion — cancel vs new "rescheduled" status based on existing status types)
- Chain cascades enabled: freeing the candidate's original appointment triggers triggerBackfill on THAT slot, potentially creating a cascade chain
- Unlimited cascade depth — natural stop via 24h decline cooldown + candidate pool exhaustion (no artificial depth limit)
- Accept confirmation message explicitly mentions the freed old appointment: "Il tuo vecchio appuntamento del [data] e' stato cancellato"

### Cascade exhaustion
- Staff notification when all candidates exhausted without filling the slot (notification channel at Claude's discretion — in-app toast vs WhatsApp to admin)
- Retry on new bookings after exhaustion: Claude's discretion on whether to re-check when new appointments are scheduled
- Maximum offers per slot cap: Claude's discretion on a reasonable limit

### Claude's Discretion
- Freed appointment status name (cancel vs rescheduled vs other)
- Staff notification channel for cascade exhaustion
- Whether to retry cascade when new bookings appear after exhaustion
- Maximum offers per slot cap (or no limit)
- Offer expiry adjustment from current 2 hours to 1 hour (per requirements)
- Cron frequency adjustment for offer expiry checks
- triggerBackfill rewrite to cascade through full candidate list (not just top 2)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/backfill/trigger-backfill.ts`: Cascade orchestrator — already called from 4 places (PATCH handler, processDecline, expirePendingOffers, check-timeouts). Needs modification: currently only tries top 2 candidates, must cascade through full list
- `src/lib/backfill/send-offer.ts`: Creates waitlist_offers row, generates HMAC tokens, sends WhatsApp via Twilio. Token links can be removed (reply-based only). Message template needs updating with full context
- `src/lib/backfill/process-response.ts`: processAccept creates new appointment + cancels sibling offers. processDecline triggers cascade. Missing: freeing candidate's original appointment + chain cascade trigger
- `src/lib/backfill/expire-offers.ts`: Batch expiry + cascade. Runs every 30 min — may need frequency increase for 1-hour timeout
- `src/lib/backfill/find-candidates.ts`: Rewritten in Phase 4 — queries appointments table, scores candidates. Ready to use as-is
- `src/app/api/webhooks/twilio/route.ts`: Full inbound routing — already classifies accept_offer/decline_offer intents, loads activeOfferId from patient context
- `src/lib/webhooks/message-router.ts`: Intent-to-handler map — handleAcceptOffer and handleDeclineOffer already exist

### Established Patterns
- Fire-and-forget: triggerBackfill called via .then() (non-blocking) from PATCH handler
- Atomic claim: processAccept uses UPDATE...WHERE status='pending' to prevent double-acceptance
- HMAC tokens for offer security (SHA-256 hash stored in DB)
- Italian response messages throughout webhook handler
- Supabase service client for server-side queries with RLS bypass
- Immutable return types (readonly arrays/objects) in backfill code

### Integration Points
- `waitlist_offers` table: full state tracking (pending/accepted/declined/expired/cancelled), 2-hour expiry (needs 1-hour), token_hash, candidate_appointment_id (from Phase 4 migration 012)
- `processAccept` line ~100: waitlist_entries update is a no-op for appointment-based candidates (null waitlist_entry_id) — safe to leave
- `expirePendingOffers`: still queries waitlist_entries (dead code for new candidates) — silently skips, no bug
- `check-timeouts` cron: calls triggerBackfill but status guard blocks it (status="timeout" not in ["cancelled","no_show"]) — dead code, may need fixing
- `OFFER_EXPIRY_HOURS = 2` in send-offer.ts — needs changing to 1

</code_context>

<specifics>
## Specific Ideas

- The offer message should feel like a personal opportunity, not a clinical notification: "Ciao [Nome]! Si e' liberato un posto..." not "Gentile paziente, le comunichiamo..."
- Patient should be able to compare dates easily: show both the offered slot and their current appointment in the same message
- Chain cascades are a differentiating feature — when one patient moves up, the freed slot benefits another patient. This is the "domino effect" that maximizes recovery

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-whatsapp-cascade*
*Context gathered: 2026-03-04*
