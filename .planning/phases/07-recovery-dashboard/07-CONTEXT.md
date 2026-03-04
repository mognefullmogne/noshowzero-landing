# Phase 7: Recovery Dashboard - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Clinic staff can see at a glance which slots have active offers, what happened recently, and how well slot recovery is performing — all updating live. This phase adds the active offers section with countdown timers and a recovery activity feed to the existing operational dashboard.

Requirements: DASH-01, DASH-02, DASH-03

</domain>

<decisions>
## Implementation Decisions

### Active offers display
- Compact row format (table-like): patient name, slot time, countdown badge — fits more offers in less space
- Show all pending offers (max 10 per slot cap keeps count manageable)
- When countdown reaches zero: auto-remove on next Realtime refresh (offer disappears from active list)
- View only — no staff action buttons. Dashboard is informational, system handles cascade automatically

### Activity feed
- Show all offer events: sent, accepted, declined, expired — with patient name, slot time, timestamp
- Last 20 events, most recent first, scrollable list
- Each event has an icon/color by type (green for accepted, red for expired, amber for sent, gray for declined)

### Dashboard layout
- Add new sections to existing operational-dashboard.tsx alongside current content
- Active offers section goes near top (high visibility, time-sensitive)
- Activity feed below active offers
- Existing KPI cards from Phase 6 already handle DASH-03 (real-time update via Realtime hook)

### Real-time countdown
- Countdown calculated client-side from offer expiry timestamp (no polling needed)
- useEffect interval updates countdown display every minute (1-hour window, minute precision sufficient)
- New events appear in feed on Realtime-triggered refetch (same pattern as existing dashboard)

### Claude's Discretion
- Exact countdown display format (e.g., "47 min" vs "00:47:00")
- Activity feed event icon/color choices
- Whether to add a "Nessuna offerta attiva" empty state or hide the section
- Scrollable container height for activity feed
- Whether to split into sub-components or keep in operational-dashboard.tsx

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `operational-dashboard.tsx`: Main dashboard component, already has AnalyticsData with slotsRecovered/fillRatePercent/revenueRecovered/activeOffers fields
- `OfferPreview` type already defined with id, status, smart_score, offered_at, patient, original_appointment
- `fetchAll()` already fetches `/api/offers?pageSize=5` — can increase pageSize or add new endpoint
- `useRealtimeAppointments` hook triggers silent refetch on appointment changes
- `MiniStat` component used for KPI cards (CheckCircle, TrendingUp, Target, Zap icons)
- Lucide icons imported, Tailwind CSS, Badge component available

### Established Patterns
- Italian labels throughout (STATUS_CONFIG has Italian status names)
- Silent refetch on Realtime updates (no loading spinner)
- Compact stat cards with icon + label + value
- `cn()` utility for conditional Tailwind classes

### Integration Points
- `/api/offers` endpoint already returns OfferPreview data — extend for active offers with expiry time
- `/api/analytics` returns recovery KPI data (already wired to dashboard)
- `waitlist_offers` table has `expires_at` field for countdown calculation
- `audit_log` table tracks cascade events (cascade_exhausted action) — extend for activity feed

</code_context>

<specifics>
## Specific Ideas

- The active offers countdown should feel urgent but not stressful — staff is watching, not acting
- Activity feed should tell the "story" of each slot recovery attempt: who was contacted, what happened
- Italian labels consistent with existing dashboard ("Offerte Attive", "Attivita' Recupero")

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-recovery-dashboard*
*Context gathered: 2026-03-04*
