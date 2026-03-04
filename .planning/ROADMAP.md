# Roadmap: NoShowZero

## Milestones

- ~~**v1.0 Realtime Infrastructure**~~ - Phases 1-3 (shipped 2026-03-03)
- **v1.1 Slot Recovery Engine** - Phases 4-7 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 Realtime Infrastructure (Phases 1-3) - SHIPPED 2026-03-03</summary>

- [x] **Phase 1: Infrastructure** - Synchronize production DB and enable Realtime publication prerequisites
- [x] **Phase 2: Core Realtime** - Implement useRealtimeAppointments hook, replace polling, add toast notifications
- [x] **Phase 3: Resilience** - Add reconnection logic, stale data recovery, and connection status indicator

### Phase 1: Infrastructure
**Goal**: Production database is fully synchronized and Realtime-ready — all migrations applied, appointments table in publication, RLS policies verified
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. A pg_dump backup of the production database exists before any migration runs
  2. All 11 migrations (001-011) are present and applied in Supabase Dashboard > Database > Migrations with zero errors
  3. The appointments table appears in Supabase Dashboard > Database > Publications under supabase_realtime
  4. Every table introduced by migrations 004-011 has RLS enabled and at least one SELECT policy visible in Supabase Dashboard > Database > Policies
  5. A WhatsApp webhook test (Twilio webhook simulator or ngrok) successfully updates an appointment status and the change persists in the database
**Plans:** 2/2 complete

Plans:
- [x] 01-01: Extend migration runner and apply to production
- [x] 01-02: Create verification script and run against production

### Phase 2: Core Realtime
**Goal**: Appointment status changes from any source appear on every staff browser within 2 seconds without a page refresh
**Depends on**: Phase 1
**Requirements**: RT-01, RT-02, RT-03, RT-06, RT-07, SEC-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. Changing an appointment status causes the appointments list to update within 2 seconds with no manual refresh
  2. The operational dashboard KPI cards reflect status changes in real-time
  3. The calendar view updates appointment colors and labels in-place when status changes
  4. A toast notification appears top-right when an appointment is confirmed
  5. The browser Network tab shows no recurring polling requests to /api/appointments
  6. Opening the app in two different browser tabs for two different tenants shows each tenant's appointments only
**Plans:** 3/3 complete

Plans:
- [x] 02-01: Create useRealtimeAppointments hook
- [x] 02-02: Wire hook into pages, remove polling
- [x] 02-03: Toast notifications and tenant security

### Phase 3: Resilience
**Goal**: The real-time connection survives network drops, browser tab switches, and overnight sessions
**Depends on**: Phase 2
**Requirements**: RT-04, RT-05
**Success Criteria** (what must be TRUE):
  1. A persistent "Live" indicator is visible in the dashboard header at all times
  2. Simulating a network interruption results in the appointments list refreshing without a page reload
  3. After reconnection, appointment status changes that occurred during disconnection are reflected
  4. The connection indicator never shows "Live" when the WebSocket channel is not actually SUBSCRIBED
**Plans:** 2/2 complete

Plans:
- [x] 03-01: Channel-level reconnection with exponential backoff and stale data recovery
- [x] 03-02: ConnectionStatus indicator component with React context bridge

</details>

### v1.1 Slot Recovery Engine

- [x] **Phase 4: Candidate Detection** - Wire cancellation trigger to auto-find and AI-rank replacement candidates from scheduled patients (completed 2026-03-04)
- [ ] **Phase 5: WhatsApp Cascade** - Send one-by-one offers with 1-hour timeout, handle accept/decline/expire, fill the slot
- [ ] **Phase 6: Revenue Metrics** - Fix inflated metrics to count only real recoveries, add configurable appointment value and fill rate
- [ ] **Phase 7: Recovery Dashboard** - Active offers with countdown, recovery activity feed, real-time KPI cards

## Phase Details

### Phase 4: Candidate Detection
**Goal**: When a patient cancels or no-shows, the system automatically identifies all viable replacement candidates from scheduled patients and ranks them by AI priority
**Depends on**: Phase 3 (v1.0 complete)
**Requirements**: SLOT-01, SLOT-02
**Success Criteria** (what must be TRUE):
  1. When a patient's appointment status changes to cancelled or no-show, the system generates a list of candidate patients from all future scheduled appointments without any staff action
  2. The candidate list is ranked by AI priority score incorporating clinical urgency, wait time, proximity to the cancelled slot's time, and patient reliability history
  3. Candidates whose existing appointment would conflict with the open slot (same time, same provider) are excluded from the list
  4. The candidate detection runs within 10 seconds of the cancellation event, producing a ranked list stored in the database ready for the cascade
**Plans:** 3/3 plans complete

Plans:
- [ ] 04-01-PLAN.md -- Test infrastructure, type contracts, scoring function, and DB migration
- [ ] 04-02-PLAN.md -- Rewrite find-candidates to query appointments table (TDD)
- [ ] 04-03-PLAN.md -- Rewire trigger-backfill and send-offer to new interfaces

### Phase 5: WhatsApp Cascade
**Goal**: The system contacts candidates one-by-one via WhatsApp until the cancelled slot is filled or all candidates are exhausted
**Depends on**: Phase 4
**Requirements**: SLOT-03, SLOT-04, SLOT-05, SLOT-06
**Success Criteria** (what must be TRUE):
  1. The top-ranked candidate receives a WhatsApp message offering the cancelled slot with clear accept/decline options
  2. If a candidate declines (via WhatsApp reply) or does not respond within 1 hour, the system automatically sends the offer to the next-ranked candidate
  3. When a candidate accepts, a new appointment is created in the cancelled slot's time and the candidate's original (later) appointment is freed for other patients
  4. The cascade stops immediately when a candidate accepts (slot filled) or when all viable candidates have been contacted (slot unfilled)
  5. No two candidates ever hold an active offer for the same slot simultaneously
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Revenue Metrics
**Goal**: Dashboard metrics reflect honest, real recovery performance -- only counting slots that were actually filled after cancellation and no-shows that were saved
**Depends on**: Phase 5
**Requirements**: METR-01, METR-02, METR-03, METR-04
**Success Criteria** (what must be TRUE):
  1. The "revenue recovered" metric counts only appointments that filled a cancelled/no-show slot via the cascade -- regular confirmations and non-recovery appointments are excluded
  2. Each tenant can set their average appointment value in a settings page, and this value is used for all revenue calculations for that tenant
  3. Fill rate percentage is calculated as (slots filled via recovery / total slots cancelled or no-showed) and displays correctly on the dashboard
  4. All metrics update in real-time as slots are recovered (leveraging existing Supabase Realtime from v1.0)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Recovery Dashboard
**Goal**: Clinic staff can see at a glance which slots have active offers, what happened recently, and how well slot recovery is performing -- all updating live
**Depends on**: Phase 6
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. An "Active Offers" section displays all pending cascade offers, each showing the patient name, slot time, and a live countdown timer showing time remaining until the 1-hour offer expires
  2. A recovery activity feed shows a chronological list of recent events: offer sent, offer accepted, offer declined, offer expired -- with timestamps and patient/slot details
  3. KPI cards (slots recovered, revenue recovered, fill rate %, active offers count) update in real-time when a slot is recovered or an offer status changes, without requiring a page refresh
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 4 -> 5 -> 6 -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure | v1.0 | 2/2 | Complete | 2026-03-03 |
| 2. Core Realtime | v1.0 | 3/3 | Complete | 2026-03-03 |
| 3. Resilience | v1.0 | 2/2 | Complete | 2026-03-03 |
| 4. Candidate Detection | 3/3 | Complete   | 2026-03-04 | - |
| 5. WhatsApp Cascade | v1.1 | 0/? | Not started | - |
| 6. Revenue Metrics | v1.1 | 0/? | Not started | - |
| 7. Recovery Dashboard | v1.1 | 0/? | Not started | - |
