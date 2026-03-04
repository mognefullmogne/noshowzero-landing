---
phase: 4
slug: candidate-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (needs Wave 0 setup) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | SLOT-01, SLOT-02 | setup | `npx vitest run` | Wave 0 | ⬜ pending |
| 04-02-01 | 02 | 1 | SLOT-01 | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -x` | Wave 0 | ⬜ pending |
| 04-02-02 | 02 | 1 | SLOT-01 | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -t "excludes cancelling patient" -x` | Wave 0 | ⬜ pending |
| 04-02-03 | 02 | 1 | SLOT-01 | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -t "24hr cooldown" -x` | Wave 0 | ⬜ pending |
| 04-02-04 | 02 | 1 | SLOT-01 | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -t "conflict" -x` | Wave 0 | ⬜ pending |
| 04-02-05 | 02 | 1 | SLOT-01 | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -t "after open slot" -x` | Wave 0 | ⬜ pending |
| 04-03-01 | 03 | 1 | SLOT-02 | unit | `npx vitest run src/lib/scoring/__tests__/candidate-score.test.ts -t "distance" -x` | Wave 0 | ⬜ pending |
| 04-03-02 | 03 | 1 | SLOT-02 | unit | `npx vitest run src/lib/scoring/__tests__/candidate-score.test.ts -t "reliability" -x` | Wave 0 | ⬜ pending |
| 04-03-03 | 03 | 1 | SLOT-02 | unit | `npx vitest run src/lib/scoring/__tests__/candidate-score.test.ts -t "ranking" -x` | Wave 0 | ⬜ pending |
| 04-03-04 | 03 | 1 | SLOT-02 | unit | `npx vitest run src/lib/backfill/__tests__/find-candidates.test.ts -t "dedup" -x` | Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install -D vitest` — install test framework
- [ ] `vitest.config.ts` — create config with path aliases matching tsconfig
- [ ] `package.json` — add `"test": "vitest run"` script
- [ ] `src/lib/backfill/__tests__/find-candidates.test.ts` — stubs for SLOT-01
- [ ] `src/lib/scoring/__tests__/candidate-score.test.ts` — stubs for SLOT-02
- [ ] `src/lib/backfill/__tests__/trigger-backfill.test.ts` — stubs for orchestration
- [ ] Test helpers: Supabase mock factory for unit tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Candidate detection completes within 10 seconds | SLOT-01 | Performance depends on production data volume | Cancel an appointment in the live app; measure time until candidates appear in DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
