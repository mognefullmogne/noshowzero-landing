---
phase: 1
slug: infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — verification script against live database |
| **Config file** | none — Wave 0 creates `scripts/verify-infrastructure.mjs` |
| **Quick run command** | `node scripts/verify-infrastructure.mjs` |
| **Full suite command** | `node scripts/verify-infrastructure.mjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/verify-infrastructure.mjs`
- **After every plan wave:** Run `node scripts/verify-infrastructure.mjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INFRA-01 | manual-only | Visual confirmation of PITR timestamp in script output | N/A | ⬜ pending |
| 01-01-02 | 01 | 1 | INFRA-02 | smoke | `node scripts/verify-infrastructure.mjs` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | INFRA-03 | smoke | `node scripts/verify-infrastructure.mjs` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | INFRA-04 | smoke | `node scripts/verify-infrastructure.mjs` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | INFRA-05 | manual-only | Twilio webhook simulator or ngrok test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-infrastructure.mjs` — post-migration verification script covering INFRA-02, INFRA-03, INFRA-04
- [ ] No test framework install needed — uses Node.js `pg` client (already in devDependencies)

*Existing `pg` package covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PITR checkpoint timestamp printed before migration | INFRA-01 | PITR is a Supabase platform feature; verification is confirming timestamp output in terminal | 1. Run `node scripts/run-migrations.mjs` 2. Confirm UTC timestamp is printed 3. Confirm script waits for Enter key before proceeding |
| Webhook flow updates appointment status end-to-end | INFRA-05 | Requires live Twilio credentials, running Vercel deployment, and an actual WhatsApp message or webhook simulator | 1. Use Twilio webhook simulator or ngrok to send a test webhook 2. Verify appointment status updates in Supabase Dashboard 3. Confirm the change persists |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
