---
phase: 06-revenue-metrics
verified: 2026-03-04T17:07:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Settings page 'Impostazioni Clinica' section loads pre-populated value and saves change"
    expected: "Number input pre-fills with current avg_appointment_value from GET /api/settings/tenant; submitting PATCH updates it; 3-second 'Salvato' confirmation appears"
    why_human: "Client-side form interaction, fetch/response cycle, and UI state transitions cannot be verified by static code analysis"
  - test: "Dashboard KPI cards update automatically after a slot is recovered in real time"
    expected: "When a waitlist_offer is accepted with a new_appointment_id, the 'Slot recuperati oggi' and 'Ricavo recuperato' cards update without a full page reload"
    why_human: "Realtime Supabase subscription behavior and live state propagation require a running environment to validate"
---

# Phase 6: Revenue Metrics Verification Report

**Phase Goal:** Dashboard metrics reflect honest, real recovery performance -- only counting slots that were actually filled after cancellation and no-shows that were saved
**Verified:** 2026-03-04T17:07:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

Plan 06-01 must-haves:

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Revenue recovered counts only appointments created via accepted waitlist_offers (new_appointment_id IS NOT NULL), not regular confirmations | VERIFIED | `analytics/route.ts` lines 50–60: `buildRecoveryQuery()` filters `.eq("status","accepted").not("new_appointment_id","is",null)`. `computeRecoveryMetrics` uses `acceptedOffersWithNewAppt` as `slotsRecovered` only. |
| 2  | Fill rate is calculated as (accepted offers for cancelled/no-show slots) / (total cancelled + no-show appointments) x 100 | VERIFIED | `recovery-metrics.ts` line 28: `Math.round((slotsFilledViaRecovery / totalCancelledOrNoShow) * 100)` with zero-division guard. 13 tests confirm correct values (30%, 100%, 0%). |
| 3  | Each tenant's avg_appointment_value is stored in the tenants table and used for revenue calculations | VERIFIED | `013_tenant_appointment_value.sql`: `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS avg_appointment_value NUMERIC(10,2) NOT NULL DEFAULT 80.00`. Analytics route fetches `avg_appointment_value` from tenants table at query time (line 100–104), not hardcoded. |
| 4  | A PATCH /api/settings/tenant endpoint allows updating avg_appointment_value with validation (positive number, max 10000) | VERIFIED | `src/app/api/settings/tenant/route.ts` exports `PATCH`. `TenantSettingsUpdateSchema` in `validations.ts` line 203–205: `z.number().positive().max(10000)`. Updates `tenants` table, returns updated record. |

Plan 06-02 must-haves:

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 5  | Tenant can see and change their average appointment value on the Settings page | VERIFIED | `settings/page.tsx`: "Impostazioni Clinica" section (line 229–301) with number input, `loadClinicSettings()` fetching `GET /api/settings/tenant`, `onClinicSubmit` `PATCH`-ing the endpoint. |
| 6  | Dashboard KPI section shows slots recovered today, revenue recovered, fill rate %, and active offers | VERIFIED | `operational-dashboard.tsx` lines 376–406: four `MiniStat` cards for "Slot recuperati oggi" (`slotsRecovered`), "Ricavo recuperato" (`revenueRecovered`), "Tasso riempimento" (`fillRatePercent`), "Offerte attive" (`activeOffers`). |
| 7  | KPI metrics update in real-time when Realtime delivers an appointment change (existing hook triggers re-fetch) | VERIFIED (wiring confirmed) | Lines 151–160: `useEffect` watching `realtimeAppointments` from `useRealtimeAppointments` triggers `fetchAll(true)` which calls `/api/analytics`. Runtime behavior needs human test. |
| 8  | Revenue recovered on dashboard uses the tenant's configured avg_appointment_value, not a hardcoded number | VERIFIED | `analytics/route.ts` fetches `avg_appointment_value` from tenants table (`tenantDataRes`), passes to `computeRecoveryMetrics`. `grep "AVG_APPOINTMENT_VALUE"` across `src/` returns zero matches. |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/013_tenant_appointment_value.sql` | avg_appointment_value column on tenants table | VERIFIED | `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS avg_appointment_value NUMERIC(10,2) NOT NULL DEFAULT 80.00` |
| `src/lib/metrics/recovery-metrics.ts` | Pure functions for honest recovery metric calculations | VERIFIED | Exports `computeFillRate`, `computeRevenueRecovered`, `computeRecoveryMetrics`. 71 lines, no stubs. |
| `src/lib/metrics/recovery-metrics.test.ts` | Test suite covering all behaviors | VERIFIED | 13 tests across 3 describe blocks. All 13 pass (`vitest run` confirmed). |
| `src/lib/types.ts` | RecoveryMetrics interface exported | VERIFIED | Lines 169–176: `RecoveryMetrics` interface with 6 readonly fields including `slotsRecovered`, `fillRatePercent`, `revenueRecovered`, `activeOffers`. |
| `src/hooks/use-tenant.ts` | avg_appointment_value in Tenant interface and query | VERIFIED | Line 17: `readonly avg_appointment_value: number`. Line 39: `avg_appointment_value` in select query string. |
| `src/app/api/analytics/route.ts` | Fixed analytics endpoint using honest recovery metrics | VERIFIED | Imports `computeRecoveryMetrics`, queries `waitlist_offers` for accepted+non-null new_appointment_id, fetches tenant value. No hardcoded constants. |
| `src/app/api/settings/tenant/route.ts` | GET and PATCH endpoint for tenant settings | VERIFIED | Exports `GET` and `PATCH`. Both authenticated via `getAuthenticatedTenant()`. PATCH validates with `TenantSettingsUpdateSchema`. |
| `src/lib/validations.ts` | TenantSettingsUpdateSchema exported | VERIFIED | Lines 203–205: `TenantSettingsUpdateSchema = z.object({ avg_appointment_value: z.number().positive().max(10000) })` |
| `src/lib/kpi/compute-snapshot.ts` | Hardcoded value removed, accepts optional avgAppointmentValue param | VERIFIED | `DEFAULT_APPOINTMENT_VALUE = 80` used only as fallback for optional parameter (line 81: `avgAppointmentValue ?? DEFAULT_APPOINTMENT_VALUE`). Queries `waitlist_offers` with `status='accepted' AND new_appointment_id IS NOT NULL`. |
| `src/app/api/v1/analytics/summary/route.ts` | Fixed v1 endpoint using honest metrics | VERIFIED | Imports `computeRecoveryMetrics`, queries `waitlist_offers` for accepted+non-null, fetches tenant `avg_appointment_value`. No hardcoded values. |
| `src/app/(app)/settings/page.tsx` | Appointment value configuration section in settings | VERIFIED | "Impostazioni Clinica" section with Euro icon, number input (step 0.01, min 1, max 10000), validation, GET fetch on mount, PATCH on submit. |
| `src/components/dashboard/operational-dashboard.tsx` | Updated KPI cards showing honest recovery metrics | VERIFIED | Lines 376–406: 4 `MiniStat` cards consuming `slotsRecovered`, `revenueRecovered`, `fillRatePercent`, `activeOffers` with backward-compatible fallbacks. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/analytics/route.ts` | `src/lib/metrics/recovery-metrics.ts` | `import computeRecoveryMetrics` | WIRED | Line 5: `import { computeRecoveryMetrics } from "@/lib/metrics/recovery-metrics"`. Called at line 143. |
| `src/app/api/analytics/route.ts` | tenants table | `fetch avg_appointment_value` | WIRED | Lines 100–104: `supabase.from("tenants").select("avg_appointment_value").eq("id",tenantId).single()`. Result used in `computeRecoveryMetrics` call. |
| `src/app/api/settings/tenant/route.ts` | tenants table | `PATCH updates avg_appointment_value` | WIRED | Lines 76–81: `.update({ avg_appointment_value: parsed.data.avg_appointment_value }).eq("auth_user_id", auth.data.userId)`. |
| `src/app/(app)/settings/page.tsx` | `/api/settings/tenant` | `fetch GET for current value, PATCH to save` | WIRED | `loadClinicSettings()` calls `fetch("/api/settings/tenant")` (GET). `onClinicSubmit()` calls `fetch("/api/settings/tenant", { method: "PATCH", ... })`. Both handle response and update state. |
| `src/components/dashboard/operational-dashboard.tsx` | `/api/analytics` | `fetchAll callback reads slotsRecovered, fillRatePercent, revenueRecovered, activeOffers` | WIRED | `fetchAll` calls `fetch("/api/analytics")`, stores in `analytics` state. KPI cards render `analytics?.slotsRecovered`, `analytics?.revenueRecovered`, `analytics?.fillRatePercent`, `analytics?.activeOffers`. |

---

### Requirements Coverage

All requirements specified in both plan frontmatters were verified. No orphaned requirements found.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| METR-01 | 06-01 | Revenue recovered counts only actually filled cancelled slots and saved no-shows | SATISFIED | Analytics route queries `waitlist_offers` with `status='accepted' AND new_appointment_id IS NOT NULL` exclusively. `computeRecoveryMetrics` uses this count as `slotsRecovered`. No regular confirmations counted. |
| METR-02 | 06-02 | Dashboard shows real-time KPIs: slots recovered today, revenue recovered, fill rate %, active offers | SATISFIED | 4 `MiniStat` cards in `operational-dashboard.tsx` display all 4 KPIs. Real-time wiring via `useRealtimeAppointments` → `fetchAll(true)` exists. Runtime behavior flagged for human check. |
| METR-03 | 06-01, 06-02 | Each tenant can configure their average appointment value in settings | SATISFIED | DB column `avg_appointment_value` (migration 013). PATCH /api/settings/tenant endpoint validated. Settings page "Impostazioni Clinica" section with fetch/save cycle. |
| METR-04 | 06-01 | Fill rate is calculated as (slots filled / slots cancelled or no-showed) x 100 | SATISFIED | `computeFillRate(slotsFilledViaRecovery, totalCancelledOrNoShow)` implements exactly this formula. `offerFillRate` in analytics response now equals `recovery.fillRatePercent`. Backfill Engine card also uses `fillRatePercent`. |

No orphaned requirements: REQUIREMENTS.md maps METR-01 through METR-04 to Phase 6, and all four are accounted for across the two plans.

---

### Anti-Patterns Found

No blockers or warnings found.

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `src/lib/kpi/compute-snapshot.ts` | `DEFAULT_APPOINTMENT_VALUE = 80` | INFO | Not a hardcoded constant replacing tenant config. Used only as a function parameter fallback: `avgAppointmentValue ?? DEFAULT_APPOINTMENT_VALUE`. This is correct per plan spec ("add optional `avgAppointmentValue` parameter with fallback to 80"). |

---

### Automated Verification Results

- `npx vitest run src/lib/metrics/recovery-metrics.test.ts`: 13/13 tests pass
- `npx tsc --noEmit`: zero errors
- `grep "AVG_APPOINTMENT_VALUE" src/`: zero matches (old hardcoded constant fully removed)
- All 5 phase commits verified in git history: `4aaf7e7`, `7432b10`, `83f54ac`, `79dc664`, `0355f11`

---

### Human Verification Required

#### 1. Settings page appointment value configuration flow

**Test:** Log in as a tenant, navigate to Settings. Observe the "Impostazioni Clinica" section. Note the current value shown. Change the value to a different number (e.g. 120) and click "Salva".
**Expected:** Input pre-fills with the tenant's stored value on page load. After save, button shows "Salvato" briefly and the new value persists on page refresh.
**Why human:** Client-side fetch/form lifecycle, success state transitions (3-second auto-dismiss), and persistence across page navigation cannot be verified by static analysis.

#### 2. Dashboard real-time KPI update on slot recovery

**Test:** Open the dashboard. Trigger a slot recovery (accept a waitlist offer that creates a new appointment). Observe whether the "Slot recuperati oggi" and "Ricavo recuperato" KPI cards update without a manual page refresh.
**Expected:** Within a few seconds of the Supabase Realtime event, `fetchAll(true)` fires and the KPI cards reflect the new recovery count and revenue.
**Why human:** Requires a live Supabase environment with Realtime enabled and an actual acceptance event to validate the subscription-to-re-fetch chain end-to-end.

---

## Summary

Phase 6 goal is fully achieved. The codebase delivers honest, real recovery performance metrics as specified:

- The analytics endpoint exclusively counts `waitlist_offers` with `status='accepted' AND new_appointment_id IS NOT NULL` as "recovered slots" — regular confirmations, completed appointments, and pending offers are correctly excluded.
- Fill rate follows the METR-04 formula: slotsRecovered / (cancelled + no-show) x 100, verified by 13 passing unit tests.
- Per-tenant `avg_appointment_value` is stored in the DB (migration 013, default EUR 80), fetched at query time (no hardcoded constants in analytics or v1 API modules), and configurable via a validated PATCH endpoint.
- The Settings page provides a working "Impostazioni Clinica" section wired to the GET/PATCH tenant settings API.
- The dashboard "Overall Stats" section replaced with 4 recovery-focused KPI cards (`slotsRecovered`, `revenueRecovered`, `fillRatePercent`, `activeOffers`) sourced from the honest analytics API, with backward-compatible fallbacks.
- All existing dashboard sections (morning briefing, recent activity, urgent deadlines, backfill engine, quick nav) remain intact.
- TypeScript compiles cleanly with zero errors.

Two human verification items are flagged: the settings save/feedback UX cycle, and the end-to-end real-time KPI update behavior in a live environment.

---

_Verified: 2026-03-04T17:07:00Z_
_Verifier: Claude (gsd-verifier)_
