# Requirements: NoShowZero — Real-Time Fix & Dashboard Polish

**Defined:** 2026-03-03
**Core Value:** When a patient confirms or cancels via WhatsApp, every staff member sees the change instantly — no refresh, no lag, no stale data.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Production database is backed up before any migration runs (PITR or manual pg_dump)
- [ ] **INFRA-02**: All pending migrations (004-011) are applied to production Supabase without data loss
- [ ] **INFRA-03**: Appointments table is added to the `supabase_realtime` publication
- [ ] **INFRA-04**: All new tables from migrations 004-011 have RLS enabled with correct SELECT policies
- [ ] **INFRA-05**: Webhook flow (Twilio → appointment status update) works reliably with all tables present

### Real-Time

- [ ] **RT-01**: Appointments list page updates within 1-2 seconds when any appointment status changes (no manual refresh)
- [ ] **RT-02**: Operational dashboard KPI cards (today's appointments, pending confirmations, urgent deadlines) update in real-time
- [ ] **RT-03**: Calendar view reflects appointment status changes in real-time
- [ ] **RT-04**: Connection state indicator visible to staff (connected / reconnecting / offline)
- [ ] **RT-05**: Automatic reconnection with stale data recovery when WebSocket disconnects and reconnects
- [ ] **RT-06**: 30-second polling replaced by Supabase Realtime subscriptions (no duplicate data paths)
- [ ] **RT-07**: Multi-channel sync — status changes from WhatsApp, SMS, email, cron, and manual dashboard actions all trigger the same real-time update

### Security

- [ ] **SEC-01**: Realtime subscriptions are tenant-scoped (no cross-tenant data leaks)
- [ ] **SEC-02**: service_role key is never exposed in client-side code or NEXT_PUBLIC_ env vars

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Notifications

- **NOTF-01**: Toast notification when an appointment confirmation arrives
- **NOTF-02**: Optional sound alert on confirmation events
- **NOTF-03**: Badge count showing number of unseen status changes
- **NOTF-04**: Browser push notifications via Service Worker

### Dashboard Polish

- **PLSH-01**: Animated status transitions when appointment status changes
- **PLSH-02**: Consistent status badge styling across all views
- **PLSH-03**: Activity feed with live-updating recent changes
- **PLSH-04**: Optimistic UI for staff-initiated status changes (useOptimistic)

### Extended Real-Time

- **ERT-01**: Realtime subscription for waitlist_entries table
- **ERT-02**: Realtime subscription for confirmation_workflows table
- **ERT-03**: Presence indicators showing which staff are currently online

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom WebSocket server | Impossible on Vercel serverless; Supabase Realtime handles it |
| Offline mutation queuing | Risky for medical data — require online connection for changes |
| Collaborative locking (pessimistic) | Overkill for 2-5 person team; last-write-wins is sufficient |
| Browser push notifications (v1) | Service Worker complexity for minimal gain this milestone |
| Local dev dashboard (localhost:3010) | User explicitly scoped to Vercel deployment only |
| TanStack Query integration | Existing useState + useEffect pattern sufficient; avoid adding dependencies |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| RT-01 | Phase 2 | Pending |
| RT-02 | Phase 2 | Pending |
| RT-03 | Phase 2 | Pending |
| RT-06 | Phase 2 | Pending |
| RT-07 | Phase 2 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| RT-04 | Phase 3 | Pending |
| RT-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after roadmap creation*
