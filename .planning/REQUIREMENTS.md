# Requirements: NoShowZero — v1.1 Slot Recovery Engine

**Defined:** 2026-03-04
**Core Value:** When a patient cancels, the system automatically fills that slot by contacting the best-fit patient via WhatsApp — no staff intervention, no empty chairs, no lost revenue.

## v1.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Slot Recovery

- [ ] **SLOT-01**: When a patient cancels or no-shows, the system automatically identifies candidate patients from all future scheduled appointments
- [ ] **SLOT-02**: Candidates are ranked by AI priority score (clinical urgency, wait time, proximity to cancelled slot, reliability history)
- [ ] **SLOT-03**: The system sends a WhatsApp offer to the top-ranked candidate with accept/decline options
- [ ] **SLOT-04**: If a candidate declines or doesn't respond within 1 hour, the system automatically offers to the next candidate
- [ ] **SLOT-05**: When a candidate accepts, a new appointment is created in the cancelled slot and the candidate's original appointment is freed
- [ ] **SLOT-06**: The cascade stops when the slot is filled or all viable candidates have been contacted

### Metrics & Revenue

- [ ] **METR-01**: Revenue recovered counts only actually filled cancelled slots and saved no-shows (not regular confirmations)
- [ ] **METR-02**: Dashboard shows real-time KPIs: slots recovered today, revenue recovered, fill rate %, active offers
- [ ] **METR-03**: Each tenant can configure their average appointment value in settings
- [ ] **METR-04**: Fill rate is calculated as (slots filled / slots cancelled or no-showed) × 100

### Dashboard

- [ ] **DASH-01**: Active offers section shows all pending cascade offers with countdown timer
- [ ] **DASH-02**: Slot recovery activity feed shows recent offer sent → accepted/declined/expired events
- [ ] **DASH-03**: KPI cards update in real-time when a slot is recovered or an offer expires

## Future Requirements

Deferred to a later milestone. Tracked but not in current roadmap.

### Extended Channels

- **CHAN-01**: SMS fallback if WhatsApp offer gets no response
- **CHAN-02**: Email notification as tertiary channel

### Past Patient Recovery

- **PAST-01**: Offer cancelled slots to past patients without a current appointment (e.g., overdue for checkup)
- **PAST-02**: AI identifies patients who are overdue based on visit history

### Advanced Analytics

- **ANAL-01**: Weekly/monthly trend charts for slot recovery performance
- **ANAL-02**: Per-provider recovery metrics
- **ANAL-03**: Comparison of AI prediction accuracy vs actual outcomes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Manual waitlist entry | System auto-detects candidates from scheduled patients — no manual list needed |
| SMS/email for offers | WhatsApp only for this milestone — patients already use it for confirmations |
| Past patients without appointments | Adds complexity; start with known-scheduled patients only |
| Calendar optimization / gap filling | Separate concern from slot recovery; defer to future milestone |
| Staff-mediated offers | System handles cascade automatically; no staff approval step needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SLOT-01 | — | Pending |
| SLOT-02 | — | Pending |
| SLOT-03 | — | Pending |
| SLOT-04 | — | Pending |
| SLOT-05 | — | Pending |
| SLOT-06 | — | Pending |
| METR-01 | — | Pending |
| METR-02 | — | Pending |
| METR-03 | — | Pending |
| METR-04 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 0
- Unmapped: 13 ⚠️

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after initial definition*
