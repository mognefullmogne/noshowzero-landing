---
phase: 3
slug: resilience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-03
---

# Phase 3 — Validation Strategy

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
- **After every plan wave:** Run `npm run build` + manual resilience verification
- **Before `/gsd:verify-work`:** Full suite must be green + all 4 success criteria verified manually
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | RT-05 | build | `npm run build` | N/A | ⬜ pending |
| 03-01-02 | 01 | 1 | RT-05 | build | `npm run build` | N/A | ⬜ pending |
| 03-02-01 | 02 | 2 | RT-04 | build+manual | `npm run build` + verify indicator states | N/A | ⬜ pending |
| 03-02-02 | 02 | 2 | RT-04 | build+manual | `npm run build` + verify hardcoded badge removed | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No new packages, no new test files, no framework changes needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Indicator shows "Live" when SUBSCRIBED | RT-04 | Requires live WebSocket + browser | Open dashboard; verify green "Live" badge visible in sidebar header |
| Indicator changes to "Reconnecting" on drop | RT-04 | Requires DevTools network throttling | DevTools > Network > Offline; verify badge changes to amber "Riconnessione..." |
| Indicator returns to "Live" on reconnect | RT-04 | Requires network restore | Re-enable network; verify badge returns to green "Live" |
| Never shows "Live" when not SUBSCRIBED | RT-04 | Requires monitoring realtimeStatus | Console log status; force CHANNEL_ERROR; verify badge shows "Offline" |
| Auto-reconnects after network drop | RT-05 | Requires real WebSocket | Offline 10s then online; verify new WS connection in Network tab |
| Stale data recovery on reconnect | RT-05 | Requires concurrent data changes | While offline, change status in another tab; re-enable; verify change appears |
| Background tab survival | RT-05 | Requires browser tab switching | Switch tab for 30s+; return; verify SUBSCRIBED or quick reconnect |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
