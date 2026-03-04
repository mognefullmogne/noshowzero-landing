# Project Handoff

> Last updated: 2026-03-04 22:40
> Session: Fixed Twilio webhook 403, phone disambiguation bug, widened dashboard layout

## Active Project

- **Path**: /Users/aiassistant/products/noshowzero-landing
- **Stack**: Next.js 15 + Supabase + Twilio WhatsApp + Claude AI (Haiku/Sonnet)
- **Branch**: `main`
- **Build status**: PASSING
- **Production**: https://noshowzero-landing.vercel.app
- **Git remote**: https://github.com/mognefullmogne/noshowzero-landing.git

## What Was Done This Session

### Twilio Webhook 403 Fix
- **Root cause**: Twilio sandbox "When a message comes in" was pointing to `https://console.twilio.com/develop/sms/settings/whatsapp-sandbox` (the console page itself) instead of our webhook URL
- **Fix**: User manually updated Twilio console to `https://noshowzero-landing.vercel.app/api/webhooks/twilio` (POST)
- Verified via Twilio Monitor alerts API — confirmed Twilio was calling wrong URL
- `TWILIO_WEBHOOK_URL` and `TWILIO_AUTH_TOKEN` env vars on Vercel were both correct

### Phone Disambiguation Bug Fix (commit `30041af`)
- **Bug**: `findPatientByPhone` in `src/app/api/webhooks/twilio/route.ts` iterated patients in arbitrary DB order — when multiple patients shared the same phone, it confirmed the wrong patient's appointment
- **Fix**: Changed to a single query with `.in("patient_id", patientIds)` sorted by `scheduled_at` ascending — now picks the patient with the **nearest future** appointment for each status priority
- **Verified**: Luca Ferrari's March 6 appointment correctly confirmed after fix

### Patient Phone Uniqueness
- All 19 patients previously shared `+393516761840` (user's test phone)
- Updated all patients to unique fake numbers (`+393331000001` through `+393331000019`)
- Only **Luca Ferrari** (`02e20e2e-06ea-4a87-9c75-e64ce4e3ac28`) keeps the real test phone `+393516761840`

### Dashboard Layout Fix (commit `07a77ca`)
- `src/app/(app)/layout.tsx`: Changed content container from `max-w-5xl` (1024px) to `max-w-7xl` (1280px), reduced padding `px-8` → `px-6`
- `src/app/(app)/calendar/page.tsx`: Added `table-fixed` to calendar table for even column distribution
- User reported pages too narrow requiring horizontal scrolling

## What To Do Next (Priority Order)

### P0 — Verify Layout Fix
- User needs to refresh and confirm calendar/appointments/all pages look correct with wider layout
- If still too narrow on their screen, may need to go to `max-w-full` or adjust further

### P1 — Continue E2E Testing
- **Test cancel flow**: Send reminder → user replies NO → verify appointment cancels + backfill cascade triggers offers
- **Test backfill cascade**: After cancellation, verify waitlisted patients get slot offers
- Backfill cascade code was deployed in PR #2 (commit `4833441`) but not yet tested end-to-end

### P2 — UI Issues from Previous Visual Audit
- `/patients` page is 404 — no frontend page exists
- Language inconsistency — Login/signup in English, should be all Italian
- Revenue shows `$0` not `€0` on analytics page
- `/onboarding` accessible post-onboarding — should redirect to `/dashboard`

### P3 — Twilio Production
- Complete Twilio number purchase (regulatory bundle pending: BU5ba25bbf9f13d345559d217d15d9e340)
- WhatsApp Business registration + Italian message templates

## Key Decisions Made

- Only Luca Ferrari has the real test phone — all other patients have fake numbers to avoid disambiguation confusion during testing
- Layout uses `max-w-7xl` (1280px) as a balance between width and readability
- Phone disambiguation picks nearest future appointment (not arbitrary DB order)

## Known Issues & Gotchas

- Twilio WhatsApp sandbox webhook URL can ONLY be changed via Twilio console UI — no API endpoint exists
- Sandbox "When a message comes in" URL must EXACTLY match `TWILIO_WEBHOOK_URL` env var for signature verification
- Test account: `aimonepitacco@gmail.com` / `Aimone123!` (may need re-reset via Supabase admin API)
- Vercel Hobby plan: crons limited to daily only
- Twilio WhatsApp sandbox: only pre-joined numbers work

## Files Changed (This Session)

### Twilio/Webhook
- `src/app/api/webhooks/twilio/route.ts` — phone disambiguation fix (nearest appointment query)
- `src/lib/webhooks/twilio-verify.ts` — temporarily added debug logging, then reverted

### Layout
- `src/app/(app)/layout.tsx` — `max-w-5xl` → `max-w-7xl`, `px-8` → `px-6`
- `src/app/(app)/calendar/page.tsx` — added `table-fixed` to calendar table

## Environment & Config

- `.env.local` has all required vars (Supabase, Stripe, Twilio, Anthropic)
- Supabase project: `hwxebnmrgrdzpfappyvk`
- Test account: `aimonepitacco@gmail.com` / `Aimone123!`
- Tenant ID: `e1d14300-10cb-42d0-9e9d-eb8fee866570`
- Test phone (Luca Ferrari only): `+393516761840`
- Twilio sandbox: `whatsapp:+14155238886`
- Twilio webhook: `https://noshowzero-landing.vercel.app/api/webhooks/twilio`

## How to Verify

```bash
npx next build        # should pass, zero errors
npx vitest run        # tests passing
npm run dev           # http://localhost:3000
```

### Webhook test
```bash
# Send test WhatsApp message via Twilio API
node -e "
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
client.messages.create({
  from: 'whatsapp:+14155238886',
  to: 'whatsapp:+393516761840',
  body: 'Test message',
  statusCallback: 'https://noshowzero-landing.vercel.app/api/webhooks/twilio',
}).then(m => console.log(m.sid));
"
```
