---
phase: 2
slug: core-realtime
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework configured; relies on TypeScript compilation |
| **Config file** | tsconfig.json (TypeScript strict mode) |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build` + manual Realtime verification
- **Before `/gsd:verify-work`:** Full suite must be green + all 6 success criteria verified manually
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | RT-01 | build | `npm run build` | N/A | ⬜ pending |
| 02-01-02 | 01 | 1 | RT-01, RT-07 | build | `npm run build` | N/A | ⬜ pending |
| 02-01-03 | 01 | 1 | RT-01 | build | `npm run build` | N/A | ⬜ pending |
| 02-02-01 | 02 | 2 | RT-01, RT-06 | build+manual | `npm run build` + verify no polling in Network tab | N/A | ⬜ pending |
| 02-02-02 | 02 | 2 | RT-02 | build+manual | `npm run build` + verify KPI updates | N/A | ⬜ pending |
| 02-02-03 | 02 | 2 | RT-03 | build+manual | `npm run build` + verify calendar updates | N/A | ⬜ pending |
| 02-03-01 | 03 | 2 | RT-01 | build+manual | `npm run build` + verify toast appears | N/A | ⬜ pending |
| 02-03-02 | 03 | 2 | SEC-01 | manual | Open two tenant sessions; verify isolation | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npx shadcn@latest add sonner` — install Sonner toast package + UI component
- [ ] `src/components/ui/sonner.tsx` — auto-created by shadcn CLI

*Existing infrastructure covers TypeScript compilation and Supabase client.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Appointments list updates within 2s | RT-01 | Requires running Supabase Realtime + authenticated browser session | Open two browser tabs; change status in one; observe update in other within 2s |
| Dashboard KPIs update in real-time | RT-02 | Requires live aggregate recalculation | Change appointment status; observe KPI card values update without refresh |
| Calendar view updates in-place | RT-03 | Requires visual verification of no flicker | Change status; observe calendar cell color/label update without full re-render |
| No polling requests in Network tab | RT-06 | Requires browser DevTools inspection | Open Network tab; wait 60s; verify no recurring /api/appointments requests |
| Multi-channel sync | RT-07 | Requires WhatsApp webhook simulation | Simulate webhook POST; observe dashboard update |
| Tenant-scoped subscriptions | SEC-01 | Requires two authenticated tenant sessions | Log in as two different tenants in separate browser profiles; verify no cross-tenant data |
| service_role key not in client code | SEC-02 | Smoke test via grep | `grep -r "SUPABASE_SERVICE_ROLE_KEY" src/ --include="*.ts" --include="*.tsx" \| grep -v "server.ts"` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
