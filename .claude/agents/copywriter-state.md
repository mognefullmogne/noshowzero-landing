# Italian Copywriter State

> Last checkpoint: 2026-03-04 23:25 — context at 85%, compact imminent

## Identity
- Role: Italian Copywriter — reviews all patient-facing Italian messages for grammar, tone, clarity, brevity
- Model: haiku (Sonnet 4.6 in practice)

## Currently Working On
**DONE** — Full copy audit complete. Report written to BOARD.md.

## Completed This Session
- Read HANDOFF.md + BOARD.md for context
- Read all 7 patient-facing message files:
  - src/lib/twilio/templates.ts
  - src/lib/confirmation/templates.ts
  - src/lib/reminders/templates.ts
  - src/app/api/webhooks/twilio/route.ts
  - src/lib/webhooks/message-router.ts
  - src/lib/booking/messages.ts
  - src/lib/scoring/ai-confirmation-personalizer.ts
  - src/app/api/offers/[offerId]/accept/route.ts
  - src/app/api/offers/[offerId]/decline/route.ts
- Wrote full Italian Copy Review section to BOARD.md (comprehensive, file-by-file, with suggested fixes)
- Updated sprint table: Copywriter task ✅
- Added to Completed section in BOARD.md

## Next Up
- No further tasks assigned to Copywriter
- Backend Engineer is implementing the fixes I identified
- Monitor BOARD.md if BOSS assigns additional copy review tasks

## Key Context — What I Found

### SYSTEMIC ISSUE #1 — Missing Accents (~20 occurrences)
Developer used apostrophe workaround instead of proper UTF-8 accented chars:
- `e'` → `è` (most common, ~15 times)
- `verra'` → `verrà`
- `sara'` → `sarà`
- `piu'` → `più`
- `gia'` → `già`
- `inattivita'` → `inattività`
- `rispondera'` → `risponderà`
- `lunedi` (no accent) → `lunedì`

### SYSTEMIC ISSUE #2 — Wrong Formality (~60% of WhatsApp templates)
Project decision: ALWAYS informal "tu" with patients.
Reality: WhatsApp confirmation/reminder templates use Lei form.
Some messages MIX Lei + tu in the same message (greeting Lei, instruction tu).

### Files with Lei-form issues (Backend must fix):
1. src/lib/confirmation/templates.ts — ALL WhatsApp templates (Touch 1, 2, 3)
2. src/lib/reminders/templates.ts — ALL WhatsApp templates
3. src/lib/twilio/templates.ts — waitlist_offer_email_body
4. src/app/api/offers/[offerId]/accept/route.ts — HTML success page
5. src/app/api/offers/[offerId]/decline/route.ts — HTML decline page
6. src/lib/scoring/ai-confirmation-personalizer.ts — medium risk WhatsApp (L269)

### Files that are ALREADY CORRECT (just need accent fixes):
- Bot replies in src/lib/webhooks/message-router.ts — good tu form
- Most of src/lib/booking/messages.ts — good tu form
- Webhook bot replies in route.ts — good tu form

### Optional (Nice-to-have):
- "slot" (English) → "posto" or "orario" in patient messages
- "Benvenuto!" → "Benvenuto/a!" (gender-neutral)
- "vecchio appuntamento" → "precedente appuntamento"

## Files I Own (locked in BOARD.md)
None — Copywriter is read-only. Backend Engineer owns the fix files.
