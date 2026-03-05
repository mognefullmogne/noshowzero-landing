# Agent Coordination Board

> All agents MUST read this file before starting work and update it when claiming/completing tasks.
> The BOSS agent manages this board. Follow BOSS directives in the "Current Sprint" section.

## Current Sprint — Sprint 2: Brand Cleanup, Deploy, Merge

**Sprint Goal**: Fix remaining brand inconsistencies, deploy to production, merge PR #1.

**Context**: Tasks #1-3 from earlier (sidebar Italian, brand fix in layout, onboarding guard) are already committed in `a7b06a8`. BOSS verified: correct Italian labels, NoShowZero brand in layout, onboarding redirect guard works. Build passes, 134/134 tests green.

**BOSS Directives** (agents: pick up your task and execute):

| # | Agent | Task | Priority | Status |
|---|-------|------|----------|--------|
| 1 | **Frontend Engineer** | **Fix stale "NowShow" brand references across codebase.** ✅ DONE — 0 NowShow refs remain, build passes. emails fixed. | The layout was fixed but other files still say "NowShow". Fix: (a) `src/lib/constants.ts` line 1: `SITE_NAME = "NowShow"` → `"NoShowZero"`. (b) Find all other `NowShow` (not `NoShowZero`) in `src/` and fix to `NoShowZero`. Check: `footer.tsx`, `faq.tsx`, `docs/page.tsx`, `chat-widget.tsx`, `dashboard/page.tsx`. (c) Fix stale email `sales@nowshow.com` → `info@noshowzero.com` in `onboarding/page.tsx:116` and `billing/page.tsx:205`. (d) Fix `support@nowshow.com` → `support@noshowzero.com` in `dashboard/page.tsx:440`. Verify: `npx next build` passes. Update this board when done. | P0 | ✅ |
 |
| 2 | **Code Reviewer** | Review commit a7b06a8 + Task #1 brand cleanup | P0 | ✅ APPROVED — see verdict below |
| 3 | **DevOps Engineer** | **Push and deploy.** BOSS verified tasks #1-2. UNBLOCKED. Steps: (a) `git add` changed files from task #1. (b) Commit: `fix: complete NowShow→NoShowZero brand rename across codebase`. (c) `git push origin redesign/landing-page`. (d) `vercel --prod --yes`. (e) Verify production: `curl -s -o /dev/null -w "%{http_code}" https://noshowzero-landing.vercel.app` returns 200. Update this board. | P0 | ✅ COMPLETE — PR merge auto-deployed @ 22:23:39 CET, production 200 OK |
| 4 | **DevOps Engineer** | **Merge PR #1 to main.** After production deploy verified: `gh pr merge 1 --squash`. Update this board. | P0 | ✅ COMPLETE — Merged 2026-03-04T21:23:35Z, commit 2de609c |

> Agents: update Status to ✅ when done, ❌ if blocked (with reason). BOSS will verify and reassign.

## Rules

1. **Before editing any file**, check "Active Work" below. If another agent owns that file, DO NOT touch it.
2. **Claim your work** by adding your agent name + files to "Active Work" before starting.
3. **Release your work** by moving to "Completed" when done.
4. **After finishing**, run `npx next build && npx vitest run` to verify.

## Active Work

_No active work — Sprint 2 tasks ready for pickup._

## Completed — Sprint 1

- Security: all 3 issues fixed (tenant_id, cron timing-safe, patient_id filter) ✅
- QA: 134/134 tests passing ✅
- Italian copy: all accents + Lei→tu in all patient-facing messages ✅
- Auth pages: login/signup/forgot-password translated to Italian ✅
- Code Review: Sprint 1 approved ✅
- Pushed: commit c535123 to origin/redesign/landing-page ✅

## Code Review — Sprint 2 Verdict (Code Reviewer, 2026-03-04 23:15)

**Commit a7b06a8**: ✅ APPROVED
- All 15 sidebar labels correctly translated to Italian
- "NoShowZero" brand correct in layout.tsx (2 spots)
- "Sign Out" → "Esci" ✅
- Onboarding redirect guard → `/dashboard` ✅
- No logic regressions, no broken imports

**Task #1 Brand Cleanup** (uncommitted `constants.ts`): ✅ APPROVED
- `SITE_NAME = "NoShowZero"` ✅
- Stale emails fixed (grep: 0 `nowshow.com` refs) ✅
- `NowShow\b` refs: 0 remaining in entire `src/` ✅
- `docs/page.tsx`, `chat-widget.tsx`, `dashboard/page.tsx`: clean ✅

**→ DevOps: unblocked. Proceed with task #3 (push + deploy) and #4 (merge).**

## Completed — Sprint 2 ✅

- Sidebar labels translated to Italian (commit a7b06a8) ✅ BOSS verified
- Brand "NoShowZero" in layout.tsx (commit a7b06a8) ✅ BOSS verified
- "Sign Out" → "Esci" (commit a7b06a8) ✅ BOSS verified
- Onboarding redirect guard (commit a7b06a8) ✅ BOSS verified
- Brand rename NowShow→NoShowZero (commit 67da594) ✅ 0 refs remain
- PR #1 merged to main (commit 2de609c) ✅ 2026-03-04T21:23:35Z
- Production deployed ✅ 22:23:39 CET — auto-triggered by PR merge, 200 OK
- Security fixes verified live: /api/intelligence/overbooking → 401, /api/cron/* → 401 ✅
- Tests: 134/134 passing (2026-03-04 22:32) ✅

## BOSS Verification Log

| Check | Result | Timestamp |
|-------|--------|-----------|
| Build passes | ✅ 0 errors | 2026-03-04 22:20 |
| Tests pass | ✅ 134/134 | 2026-03-04 22:03 |
| No `user_metadata.tenant_id` | ✅ Zero refs | 2026-03-04 22:03 |
| No insecure cron `===` | ✅ Zero refs | 2026-03-04 22:03 |
| No hardcoded secrets | ✅ Clean | 2026-03-04 22:03 |
| No `Gentile` (Lei form) | ✅ Zero refs | 2026-03-04 22:03 |
| No `e'` accents | ✅ Zero patient-facing | 2026-03-04 22:03 |
| Sidebar labels Italian | ✅ All 15 translated | 2026-03-04 22:20 |
| Brand "NoShowZero" in layout | ✅ Fixed in 2 spots | 2026-03-04 22:20 |
| "Esci" replaces "Sign Out" | ✅ | 2026-03-04 22:20 |
| Onboarding redirect guard | ✅ router.push("/dashboard") | 2026-03-04 22:20 |
| `SITE_NAME` constant | ✅ "NoShowZero" | 2026-03-04 22:30 |
| `nowshow.com` emails | ✅ Zero refs | 2026-03-04 22:30 |
| `NowShow` standalone refs | ✅ Zero in src/ | 2026-03-04 22:30 |
| Deployed to production | ✅ 200 OK | 2026-03-04 22:23 CET (auto-deploy on PR merge) |
| PR #1 merged | ✅ Merged | 2026-03-04 21:23 UTC, commit 2de609c |

## Build Status

- **Last verified by**: DevOps Engineer (2026-03-04 22:32)
- **Status**: ✅ Build PASSING — 134/134 tests green — PR #1 MERGED — Production LIVE
- **Branch**: main @ 2de609c (merged from redesign/landing-page)
