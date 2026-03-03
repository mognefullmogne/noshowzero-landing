# Feature Landscape: Real-Time Appointment Dashboard

**Domain:** Medical appointment management SaaS — real-time dashboard updates
**Project:** NoShowZero real-time fix and dashboard polish milestone
**Researched:** 2026-03-03
**Stack context:** Next.js + Supabase Realtime (Postgres changes over WebSocket) + Twilio WhatsApp/SMS

---

## Table Stakes

Features users expect from a real-time scheduling dashboard. Missing any of these = product feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Appointment status updates without page refresh | Core value prop of NoShowZero; clinics explicitly expect instant sync | Medium | Supabase Realtime Postgres changes subscription on `appointments` table; all status columns |
| Color-coded status in calendar view | Universal UX pattern in every scheduling tool (Google Calendar, Calendly, Acuity); users read status at a glance | Low | Confirmed = green, Pending = yellow, Cancelled = red, No-show = grey. Must update in-place without re-render flicker |
| Visual connection status indicator | Users must know if they are seeing live data or stale data; invisible disconnects erode trust | Low | Persistent pill/dot in header: "Live" (green dot) vs "Reconnecting..." (yellow spinner) vs "Offline — data may be stale" (red). Not a toast — permanent while disconnected |
| In-app toast on confirmation arrival | Staff expect to be notified when patient confirms via WhatsApp without watching the screen | Low | Short-lived (4-5s), top-right, non-blocking; message: "Stefano Rossi confirmed for 09:00" with status color accent |
| Reconnection after disconnect | Network drops, laptop sleeps, browser tabs idle — dashboard must recover without a manual refresh | Medium | Exponential backoff (500ms → 30s max), heartbeat mechanism, auto-resubscribe after reconnect |
| Stale data recovery on reconnect | On reconnect, local state may be minutes out of date — must re-fetch current state | Medium | On CHANNEL_ERROR or reconnect: fetch current appointment list from REST, then re-subscribe. Do NOT rely only on missed events |
| Multi-tenant subscription scoping | Two clinics must never see each other's real-time updates | Medium | Supabase RLS filters at DB level; additionally scope subscription filter to `tenant_id = eq.{tenantId}` in channel config |
| Appointment list live update | List view (table/agenda) must reflect changes alongside calendar view | Low | Same subscription drives both views via shared state (React context or Zustand) |

---

## Differentiators

Features that create competitive advantage. Not universally expected, but meaningfully improve the product for the 2-5 staff clinic segment.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Audible notification on confirmation | In a clinic, staff are not watching screens; a sound cue means zero-latency awareness without a separate alerting system | Low | Browser `AudioContext` or `<audio>` tag; short chime (~0.5s) on confirmed status event. Requires user gesture to enable audio on first interaction (browser policy). Toggle in settings — not all clinics want sound |
| "Who else is viewing" presence indicators | Small teams (2-5 staff) benefit from knowing a colleague already saw and acted on a change — reduces duplicate actions | High | Supabase Realtime Presence channel alongside Postgres changes. Shows avatar or initials. Do NOT implement for v1 of this milestone — this is complex enough to be its own phase |
| Optimistic status change | When staff clicks "mark confirmed", UI responds instantly (100ms feel) without waiting for server round-trip | Medium | Use React `useOptimistic` (React 19) or TanStack Query `onMutate`. Automatic rollback on error. Apply to: mark-confirmed, mark-cancelled, mark-no-show. Do NOT apply to booking creation (too many side effects to rollback cleanly) |
| WhatsApp source badge on status change | Shows HOW the status was updated (WhatsApp icon, SMS icon, manual). Gives staff confidence the system is working | Low | Add `source` field to real-time event payload or read from existing `message_events` table after migrations run |
| Browser tab badge count | Shows unread status changes on tab when clinic staff switch away — brings them back to the dashboard | Medium | Web App Badge API (`navigator.setAppBadge(count)`). Supported in Chrome/Edge as PWA, not Safari. Reset on tab focus. Flag as LOW confidence on Safari support |

---

## Anti-Features

Things to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Browser push notifications (OS-level) | Requires Service Worker, notification permission prompt, and push subscription management — 3x the complexity for marginal gain in a tab-based clinic app | In-app toasts + optional sound cover the same use case for staff who are already at their desk |
| Collaborative lock / pessimistic locking | "This appointment is being edited by Maria" locks create frustration in a 2-5 person team. All appointment state transitions are atomic (status enum changes) — no free-form concurrent editing | Use last-write-wins (LWW): most recent DB write wins. Realtime update broadcasts the winner to all connected clients automatically |
| CRDT / operational transform for conflicts | Overkill for appointment status. Status is an enum — concurrent writes are resolved by DB timestamp naturally. CRDTs are for collaborative text editing | LWW via Supabase DB constraints is sufficient |
| Custom WebSocket server | Vercel is serverless — no persistent WS server possible. Building one requires additional infrastructure | Supabase Realtime handles WebSocket connection client-side, no server needed |
| Offline queue / write-ahead log | Storing failed mutations for retry-on-reconnect is complex and risky for medical data (could replay a cancelled booking). Staff can manually recheck after reconnect | Show clear "offline" state, block mutations while offline, rehydrate from REST on reconnect |
| SMS/WhatsApp real-time stream in dashboard | Showing the raw message conversation inline is a different product surface (CRM-like). Scope of this milestone is appointment STATUS, not message content | Link to thread if needed; don't embed conversation stream in the appointment card for this milestone |

---

## Feature Dependencies

```
Supabase Realtime subscription
  → Appointment list live update
  → Calendar view live color update
  → In-app toast notification
  → Audible chime (on top of toast)
  → Browser tab badge

Connection state indicator
  → Reconnection logic (exponential backoff + heartbeat)
  → Stale data recovery (REST re-fetch on reconnect)
  → Block mutations while offline (optional guard)

Migrations 004-011 applied to production DB
  → message_events table (for WhatsApp source badge)
  → All real-time subscriptions (tables must exist to subscribe)

Multi-tenant RLS already in place
  → Subscription scoping (filter by tenant_id in channel config)
```

---

## Detailed Feature Breakdown by Question

### 1. Real-Time Status Updates — What Exactly Updates Live

**Must update on Supabase Realtime `appointments` table changes:**

- Status field: `pending → confirmed → cancelled → no_show → completed`
- Appointment card color in calendar grid (in-place, no full re-render)
- Status badge in list/agenda view
- Count summaries ("3 confirmed, 1 pending today") in dashboard header
- Waitlist slot availability (if an appointment is cancelled, a waitlist slot opens — this may drive a separate `waitlist_entries` subscription)

**Does NOT need real-time (polling or manual refresh is fine):**

- Historical reporting and KPI charts (30s polling acceptable)
- Patient profile details
- Billing/Stripe state

**Implementation path:** Single Supabase channel with filter `schema: 'public', table: 'appointments', filter: 'tenant_id=eq.{tenantId}'`. Listen for `INSERT`, `UPDATE`, `DELETE` events. On event: update React state via dispatch, trigger toast if status changed to `confirmed`.

### 2. Notification Patterns — Hierarchy for This Product

Tier 1 (required, table stakes): **In-app toast** — "Rossi confirmed 09:00" — 5 second auto-dismiss, action link to appointment card, non-blocking, stacks if multiple arrive.

Tier 2 (differentiator): **Audible chime** — Short non-intrusive sound. Must be opt-in (browser audio policy requires user gesture; store preference in localStorage). Use a soft positive chime for confirmed, no sound for other statuses (cancelled is negative — no celebratory tone).

Tier 3 (differentiator, deferred): **Browser tab badge** — `navigator.setAppBadge(N)` where N = unread confirmation count since last focus. Reset on window focus event. Requires PWA manifest for Chrome/Edge. Skip for this milestone.

Tier 4 (anti-feature for this milestone): **Browser push notifications** — Out of scope.

**Toast UX rules:**
- Position: top-right (not bottom — bottom is covered by Italian cookie consent banners in many EU deployments)
- Maximum 3 toasts stacked before oldest is dismissed
- Confirmation = green accent, Cancellation = red accent, Reconnected = blue informational
- No toast for reconnection itself — use persistent connection status indicator instead

### 3. Multi-User Collaboration — What Happens When 2 Staff See the Same Change

For 2-5 staff small clinics, the collaboration model is **broadcast, not lock**:

1. Staff A marks appointment as confirmed via dashboard.
2. API updates DB (status = confirmed).
3. Supabase Realtime broadcasts the UPDATE event to all connected subscribers for that tenant.
4. Staff B's dashboard receives the event and updates in real-time — they see the status change without any action on their part.
5. **No conflict** — appointment status is a single atomic field, not a document. Last write wins. Supabase enforces this at DB level.

**Edge case — simultaneous writes:** If Staff A and Staff B both try to mark the same appointment at the same millisecond (vanishingly rare in a 2-5 person clinic), DB serializes the writes. The Realtime event for the second write broadcasts the final state. Both staff see the same final state within 1-2 seconds. No special conflict UI needed.

**What to show during a status change in flight:** Use optimistic UI so the initiating staff member sees instant feedback. The broadcast to Staff B happens after DB commits. Staff B never sees a "stale pending" state for more than 1-2 seconds.

### 4. Calendar Real-Time Sync — How Live Calendar Updates Work

**Pattern: In-place cell mutation, not full calendar re-render.**

When an appointment UPDATE event arrives:
1. Find the appointment in local state by `id`.
2. Replace only that appointment's record (immutable update — new object, not mutation).
3. The calendar cell for that time slot re-renders with the new color/status badge.
4. No skeleton loading, no full calendar refresh.

**Status color mapping (standard industry pattern):**
- `confirmed` → green (`#22c55e`)
- `pending` → amber (`#f59e0b`)
- `cancelled` → red/strikethrough (`#ef4444`, opacity 0.5)
- `no_show` → grey (`#6b7280`)
- `completed` → blue-grey (`#64748b`)

**Animation:** Brief 300ms background flash on the updated cell (CSS transition) to draw the eye to what changed. Avoid persistent animations — they become noise.

**Day/week/month views:** All views driven from the same appointment state atom. When state updates, React rerenders only the affected cell (memoized components).

### 5. Connection State Handling — WebSocket Disconnects

**Supabase Realtime channel status states:**
- `SUBSCRIBED` — live and receiving events
- `CHANNEL_ERROR` — error during subscription setup
- `TIMED_OUT` — Realtime server did not respond in time
- `CLOSED` — channel was closed (network drop, browser sleep, etc.)

**Recommended handling for NoShowZero:**

```
SUBSCRIBED → show "Live" green indicator
CHANNEL_ERROR / TIMED_OUT → show "Reconnecting..." yellow indicator
  → attempt reconnect with exponential backoff: 500ms, 1s, 2s, 4s, 8s, 16s, 30s max
  → on each reconnect attempt: resubscribe to channel
CLOSED → same as CHANNEL_ERROR
  → additionally: fetch current state via REST on reconnect (stale data recovery)
After 5 failed attempts → show "Connection lost — click to retry" persistent banner
  → allow manual retry button
```

**Heartbeat:** Enable `worker: true` in Supabase Realtime client config to offload heartbeat to Web Worker — prevents browser throttling from killing the connection when the tab is in the background (clinic staff may have multiple tabs open).

**Stale data recovery is critical:** Do not rely only on replaying missed events. On reconnect, fetch the full current state from the REST API (`GET /appointments?date=today`) and merge with local state. This handles the case where the clinic laptop was closed for 20 minutes and many changes occurred.

### 6. Optimistic UI — Should Status Changes Show Before Server Confirms

**Yes, for staff-initiated actions. No, for webhook-triggered events.**

**Apply optimistic updates to:**
- Staff manually marking an appointment confirmed/cancelled/no-show via dashboard button
- Complexity: LOW to MEDIUM — status is an enum, rollback is simple (revert to previous status)
- Use React `useOptimistic` (React 19) or TanStack Query `onMutate` + `onError` rollback
- Show a loading spinner on the specific appointment card's status badge during the optimistic phase
- On error: revert status badge, show inline error toast ("Failed to update — check connection")

**Do NOT apply optimistic updates to:**
- Appointment creation — too many side effects (reminder scheduling, waitlist checks, calendar sync)
- WhatsApp-triggered status changes — these arrive via Realtime subscription, not user action

**Rollback UX:** Do not show a generic error toast alone. Show the appointment card return to its previous state with a brief red flash, then the error message. Users need to see WHERE the failure was, not just that "something failed."

---

## MVP Recommendation for This Milestone

**Priority 1 — Table stakes (must ship):**
1. Supabase Realtime subscription on `appointments` table (scoped to tenant)
2. Calendar view live color update on status change
3. Appointment list live update
4. Connection status indicator (Live / Reconnecting / Offline)
5. Reconnection with exponential backoff + stale data recovery on reconnect
6. In-app toast on `confirmed` status (from any channel: WhatsApp, SMS, manual)

**Priority 2 — Ship if time allows:**
7. Optimistic UI for staff-initiated status changes
8. Audible chime (opt-in, stored in localStorage)

**Defer to next milestone:**
- Browser tab badge (requires PWA scaffolding)
- Presence indicators (separate Realtime Presence channel — significant complexity)
- WhatsApp source badge (depends on migrations 004-011 being applied and `message_events` table)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Supabase Realtime channel states | HIGH | Official Supabase docs + GitHub issues confirm SUBSCRIBED/CLOSED/TIMED_OUT/CHANNEL_ERROR |
| Reconnect strategy (backoff + heartbeat) | HIGH | Multiple authoritative sources; Supabase docs explicitly recommend `heartbeatCallback` + `worker: true` |
| Industry notification patterns (toasts) | HIGH | Carbon Design System + LogRocket docs + multiple UX pattern guides agree |
| Optimistic UI with `useOptimistic` | HIGH | React 19 official docs; supported in the Next.js App Router context of this project |
| Last-write-wins for small team collisions | MEDIUM | Correct for enum status fields; verified by distributed systems literature; no scheduling-specific case study found |
| Browser tab badge (PWA Badge API) | MEDIUM | MDN docs confirm API exists; Safari support is incomplete as of 2025 |
| Audible chime browser policy | MEDIUM | Web Audio API autoplay policy is well documented; specific UX guidance for medical apps is LOW confidence (no specific source found) |

---

## Sources

- [Supabase Realtime — Silent Disconnections Guide](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794)
- [Supabase Realtime — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase — Auto reconnect discussion](https://github.com/orgs/supabase/discussions/27513)
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [WebSocket Reconnection — Exponential Backoff](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1)
- [WebSocket Reconnection Logic](https://oneuptime.com/blog/post/2026-01-24-websocket-reconnection-logic/view)
- [React useOptimistic — Official Docs](https://react.dev/reference/react/useOptimistic)
- [TanStack Query — Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [Understanding Optimistic UI + useOptimistic — LogRocket](https://blog.logrocket.com/understanding-optimistic-ui-react-useoptimistic-hook/)
- [Toast Notifications — UX Best Practices — LogRocket](https://blog.logrocket.com/ux-design/toast-notifications/)
- [Carbon Design System — Notification Pattern](https://carbondesignsystem.com/patterns/notification-pattern/)
- [Carbon Design System — Status Indicators](https://carbondesignsystem.com/patterns/status-indicator-pattern/)
- [Web App Badge API — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Display_badge_on_app_icon)
- [Last Write Wins in Distributed Systems](https://www.numberanalytics.com/blog/last-writer-wins-distributed-systems)
- [Conflict Resolution — LWW vs CRDTs](https://dzone.com/articles/conflict-resolution-using-last-write-wins-vs-crdts)
