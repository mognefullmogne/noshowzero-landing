---
phase: 05-whatsapp-cascade
plan: 01
subsystem: api
tags: [twilio, whatsapp, cron, cascade, italian, backfill]

# Dependency graph
requires:
  - phase: 04-candidate-detection
    provides: "findCandidates with RankedCandidate interface including currentAppointmentAt"
provides:
  - "Italian reply-based WhatsApp offer template (SI/NO, no URLs)"
  - "1-hour offer expiry with 15-minute cron detection"
  - "MAX_OFFERS_PER_SLOT=10 cascade guard"
  - "Cascade exhaustion detection with audit_log entry"
  - "Clean cascade plumbing (no dead waitlist_entries code)"
affects: [05-whatsapp-cascade, webhook-handler, dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reply-based WhatsApp offers (no URL tokens in message)"
    - "Audit log for cascade exhaustion notification"
    - "MAX_OFFERS_PER_SLOT constant for cascade safety"

key-files:
  created: []
  modified:
    - "src/lib/twilio/templates.ts"
    - "src/lib/backfill/offer-tokens.ts"
    - "src/lib/backfill/send-offer.ts"
    - "src/lib/backfill/trigger-backfill.ts"
    - "src/lib/backfill/expire-offers.ts"
    - "src/lib/backfill/process-response.ts"
    - "vercel.json"

key-decisions:
  - "MAX_OFFERS_PER_SLOT set to 10 — reasonable cap preventing runaway cascades"
  - "Cascade exhaustion recorded via audit_log insert (dashboard already queries audit_log)"
  - "WhatsApp template uses SI/NO reply, SMS/email keep URL-based links as fallback"
  - "Token generation still occurs for DB security (token_hash), but URLs omitted from WhatsApp message body"

patterns-established:
  - "Reply-based WhatsApp offers: template contains no URLs, patient replies SI or NO"
  - "Cascade safety: MAX_OFFERS_PER_SLOT guard before sending"
  - "Cascade exhaustion: audit_log entry with offers_sent count"

requirements-completed: [SLOT-03, SLOT-04, SLOT-06]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 5 Plan 1: WhatsApp Cascade Engine Summary

**Italian reply-based offer template with 1-hour expiry, MAX_OFFERS_PER_SLOT=10 guard, cascade exhaustion notification via audit_log, and dead waitlist_entries code removal**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T14:46:33Z
- **Completed:** 2026-03-04T14:50:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- WhatsApp offer template rewritten in Italian "tu" form with SI/NO reply instructions, current appointment comparison, and 1-hour time limit
- Offer expiry changed from 2 hours to 1 hour, cron frequency increased to every 15 minutes
- MAX_OFFERS_PER_SLOT=10 guard prevents runaway cascades
- Cascade exhaustion detection with audit_log entry for staff visibility
- Dead waitlist_entries code removed from expire-offers.ts, processAccept, and processDecline
- Removed retry logic (candidates[1] fallback) — cascade handles retries via decline/expire flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite offer message template and change expiry to 1 hour** - `34bb106` (feat)
2. **Task 2: Clean cascade plumbing — dead code removal, max offers cap, exhaustion notification** - `362f5a3` (feat)

## Files Created/Modified
- `src/lib/twilio/templates.ts` - Italian reply-based WhatsApp template with current appointment comparison, provider suffix
- `src/lib/backfill/offer-tokens.ts` - OFFER_EXPIRY_HOURS changed from 2 to 1
- `src/lib/backfill/send-offer.ts` - Formats candidate's currentAppointmentAt into Italian locale for template
- `src/lib/backfill/trigger-backfill.ts` - MAX_OFFERS_PER_SLOT guard, cascade exhaustion audit_log, removed retry logic
- `src/lib/backfill/expire-offers.ts` - Removed dead waitlist_entries queries, cleaned select columns
- `src/lib/backfill/process-response.ts` - Removed waitlist_entries fulfilled update and decline join/updates
- `vercel.json` - expire-offers cron changed to every 15 minutes

## Decisions Made
- MAX_OFFERS_PER_SLOT set to 10 (reasonable cap per user's discretion allowance)
- Cascade exhaustion notification via audit_log insert — dashboard already queries this table
- Token generation preserved for DB record security (token_hash), but URLs not included in WhatsApp message
- SMS/email templates kept URL-based as fallback channels

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Cascade engine core is complete: send, expire, cascade, exhaust
- Ready for 05-02: accept/decline response processing, chain cascades on acceptance, webhook handler updates

## Self-Check: PASSED

All 7 modified files verified present. Both commits (34bb106, 362f5a3) verified in git log.

---
*Phase: 05-whatsapp-cascade*
*Completed: 2026-03-04*
