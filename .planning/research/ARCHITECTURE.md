# Architecture Patterns: Supabase Realtime in Next.js App Router

**Project:** NoShowZero — Real-Time Appointment Dashboard
**Dimension:** Realtime integration architecture
**Researched:** 2026-03-03
**Confidence:** HIGH (verified against Supabase official docs, codebase inspection, React patterns)

---

## Context: What Already Exists

The codebase is a **Next.js 16 (App Router) + Supabase + Vercel** app with React 19. The current
data fetching model is 30-second client-side polling in two key places:

- `OperationalDashboard` — fetches `/api/dashboard`, `/api/analytics`, `/api/offers` every 30s
- `AppointmentsPage` — fetches `/api/appointments` every 30s

Both are already `"use client"` components with `useState` + `useEffect` + `useCallback`. The
Supabase browser client (`createBrowserClient` via `@supabase/ssr`) already exists at
`src/lib/supabase/client.ts`. The tenant ID is available via `useTenant()` hook.

No existing Realtime subscriptions. No provider layer. No context for real-time state.

---

## Core Architectural Constraint

**Vercel is serverless — no persistent server process can hold WebSocket connections.**

Supabase Realtime is the correct answer here: the WebSocket connection lives entirely
**client-side** in the browser. The Vercel functions remain stateless. Supabase's cloud
infrastructure maintains the WebSocket server. This is already the intended deployment model.

---

## Recommended Architecture

### Subscription Location: Custom Hook, Not Provider

**Recommendation: Per-feature custom hooks, not a global provider.**

Rationale:
- The app has 2-5 concurrent staff users per clinic. Connection count is not a scaling concern
  (Supabase Free tier: 200 peak connections; Pro: 500).
- Staff only have one dashboard view open at a time. Global provider adds complexity for no gain.
- The existing pattern (hook-per-page) maps cleanly onto hook-per-subscription.
- A global provider at `(app)/layout.tsx` would subscribe even on pages that don't need realtime
  (Billing, Settings, Docs). Wasteful.

**The correct granularity:** One hook per data domain that needs real-time updates:
- `useRealtimeAppointments(tenantId)` — used in `AppointmentsPage` and `OperationalDashboard`
- No need for separate dashboard/calendar hooks; they all subscribe to the same table changes.

**Where NOT to put subscriptions:**
- `(app)/layout.tsx` — too broad, subscribes for all routes unnecessarily
- Server Components — impossible; WebSockets are browser-only
- Route Handlers (API routes) — wrong layer; these are HTTP endpoints, not persistent

---

## Component Boundaries

```
(app)/layout.tsx                    [Client Component — already "use client"]
  └─ useTenant()                    [existing hook — provides tenant.id]
  └─ AppLayout renders children

(app)/dashboard/page.tsx            [Client Component]
  └─ OperationalDashboard           [Client Component — target for realtime]
       └─ useRealtimeAppointments(tenantId)   [NEW hook]
            ├─ initial fetch: GET /api/dashboard on mount
            └─ realtime delta: Supabase channel subscription

(app)/appointments/page.tsx         [Client Component]
  └─ AppointmentsTable              [existing component]
  └─ useRealtimeAppointments(tenantId)        [same NEW hook, reused]

src/lib/supabase/client.ts          [existing — createBrowserClient]
  └─ used by the new hook for channel creation

Supabase Realtime Service           [external — Supabase cloud]
  └─ postgres_changes on "appointments" table
  └─ filtered by tenant_id via RLS (automatic when user session present)

Twilio Webhook → /api/webhooks/twilio → DB UPDATE → Supabase Realtime notifies clients
```

### What Talks to What

| Component | Communicates With | Protocol |
|-----------|------------------|----------|
| `useRealtimeAppointments` hook | Supabase Realtime service | WebSocket (browser) |
| `useRealtimeAppointments` hook | `/api/dashboard` (initial load) | HTTP fetch |
| Twilio webhook handler | Supabase DB (via server client) | PostgreSQL |
| Supabase DB | Supabase Realtime service | Postgres logical replication |
| Supabase Realtime service | Browser (hook) | WebSocket push |
| `OperationalDashboard` | `useRealtimeAppointments` | React state |

---

## Data Flow

### Full Round-Trip: WhatsApp Confirmation

```
1. Patient replies "SI" to WhatsApp message
      ↓
2. Twilio sends HTTP POST to /api/webhooks/twilio
      ↓
3. Route Handler (serverless function):
   - Parses Twilio payload
   - Identifies appointment by phone/thread
   - Calls supabase (server client, service role): UPDATE appointments SET status='confirmed'
      ↓
4. PostgreSQL logical replication captures the row change
      ↓
5. Supabase Realtime server evaluates active subscriptions:
   - Checks which connected clients subscribe to `appointments` table
   - Applies RLS check: does this client's session have SELECT access to this row?
   - Sends change event only to authorized clients
      ↓
6. Browser WebSocket receives payload:
   {
     schema: "public",
     table: "appointments",
     eventType: "UPDATE",
     new: { id: "...", status: "confirmed", tenant_id: "...", ... },
     old: { id: "...", status: "reminder_sent", ... }
   }
      ↓
7. useRealtimeAppointments callback runs:
   - Merges new record into local React state (immutable update)
   - Toast notification fires: "Stefano Rossi confirmed — Esame prostata 06/03"
      ↓
8. React re-renders OperationalDashboard:
   - Status badge changes from "In attesa" to "Confermato"
   - KPI counters update (pendingCount -1)
   - No network request needed — state already updated
```

**Target latency from step 3 to step 8: 1-2 seconds** (Supabase Realtime typical P95).

---

## Implementation Pattern: `useRealtimeAppointments`

### Correct Pattern (MEDIUM confidence — from official Supabase patterns + React docs)

```typescript
// src/hooks/use-realtime-appointments.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeAppointments(tenantId: string | null) {
  const [appointments, setAppointments] = useState<readonly Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  // Initial data load
  const fetchInitial = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const res = await fetch("/api/dashboard");
    const data = await res.json();
    if (data.success) setAppointments(data.data.recentActivity ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // Realtime subscription
  useEffect(() => {
    if (!tenantId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`appointments:${tenantId}`)          // unique channel name per tenant
      .on(
        "postgres_changes",
        {
          event: "*",                               // INSERT | UPDATE | DELETE
          schema: "public",
          table: "appointments",
          // RLS handles tenant scoping automatically when user session is valid
          // Optionally add explicit filter for defense-in-depth:
          // filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          setLastEvent({ type: payload.eventType, record: payload.new ?? payload.old });

          if (payload.eventType === "INSERT") {
            setAppointments((prev) => [payload.new as Appointment, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setAppointments((prev) =>
              prev.map((a) => a.id === payload.new.id ? { ...a, ...payload.new } : a)
            );
          } else if (payload.eventType === "DELETE") {
            setAppointments((prev) => prev.filter((a) => a.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          // Supabase retries automatically; log for monitoring
          console.error("[Realtime] channel error — will retry");
        }
        if (status === "TIMED_OUT") {
          // Remove and resubscribe
          supabase.removeChannel(channel);
          // useEffect cleanup + re-run handles this via dependency change or manual trigger
        }
      });

    // Cleanup: critical for React StrictMode (double-mount) and route changes
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  return { appointments, loading, lastEvent, refetch: fetchInitial };
}
```

### Key Implementation Rules

1. **Always return a cleanup function** that calls `supabase.removeChannel(channel)`. React 19
   in strict mode mounts effects twice in development. Without cleanup, channels accumulate
   and hit the channel limit. This is a known React + Supabase issue — cleanup is mandatory.

2. **Channel name must be unique per tenant** to avoid cross-tenant event leakage at the
   WebSocket multiplexing layer. Pattern: `appointments:${tenantId}`.

3. **Do not create a new `createClient()` call inside the subscribe callback** — create it once
   per effect. The browser client maintains a singleton WebSocket connection.

4. **Immutable state updates only.** Use `prev.map(...)` and `prev.filter(...)`, never mutate
   the array in place.

---

## Multi-Tenant Channel Design

### RLS as Primary Security (HIGH confidence)

Supabase Realtime applies RLS policies to every change event before delivering it to a client.
When the browser client has an active authenticated session (cookie-based via `@supabase/ssr`),
the Realtime server checks the user's RLS policies before forwarding any event.

Existing RLS policies on the `appointments` table already filter by `tenant_id`. These policies
apply automatically to Realtime subscriptions when the user is authenticated.

**Result: One global `appointments` subscription is safe.** The Realtime server will only push
events for rows that pass the authenticated user's RLS check.

### Optional Explicit Filter (Defense in Depth)

Add `filter: \`tenant_id=eq.${tenantId}\`` to the subscription as a secondary guard.

Benefits:
- Reduces server-side work (fewer events evaluated against RLS)
- Explicit intent in code
- Safety net if RLS is ever misconfigured

Note: This requires `tenant_id` to be a stable, non-null string in the browser session. The
existing `useTenant()` hook already provides this.

### Channel Naming Convention

```
appointments:{tenantId}     — main appointment changes
```

A single channel can subscribe to multiple table events. There is no need for separate channels
per event type. Keep the channel count at 1-2 per active user session.

---

## State Management: Merging Realtime Deltas with Fetched Data

### Pattern: Initial Fetch + Delta Merge (recommended for this codebase)

This fits naturally because the existing components already use `useState` + `setAppointments`.

```
On mount:
  → HTTP fetch → full list → setState(list)

On realtime event:
  → INSERT: setState([newRecord, ...prev])
  → UPDATE: setState(prev.map(replace matching record))
  → DELETE: setState(prev.filter(remove matching record))
```

**Alternative: Realtime triggers `router.refresh()`**

For Server Components. Not applicable here — all dashboard pages are already `"use client"`.
`router.refresh()` causes a full re-render and a new server round-trip. Avoid — defeats the
purpose of Realtime.

**Alternative: Realtime triggers TanStack Query `invalidateQueries`**

Cleaner cache management, automatic deduplication. Appropriate if this project adopts React
Query. Not currently in the dependency list. Do not add it just for this feature — the delta
merge pattern is sufficient for the current data volumes (small clinics, <100 appointments/day).

**Decision: Pure useState delta merge.** No new dependencies. Fits existing patterns.

### Toast Notification Layer

The `lastEvent` value from the hook feeds a separate notification component:

```typescript
// In OperationalDashboard or a shared NotificationToast component:
useEffect(() => {
  if (!lastEvent) return;
  if (lastEvent.type === "UPDATE" && lastEvent.record.status === "confirmed") {
    showToast(`Confirmed: ${lastEvent.record.patient_name}`);
  }
}, [lastEvent]);
```

---

## Connection Lifecycle

### Subscribe on Mount, Cleanup on Unmount

The `useEffect` with `return () => supabase.removeChannel(channel)` handles this correctly.

### Reconnect Strategy

Supabase Realtime client (`@supabase/realtime-js`, bundled with `@supabase/supabase-js`) handles
reconnection automatically. The client:
- Attempts to reconnect after `CLOSED` or `TIMED_OUT`
- Backs off exponentially
- No manual reconnect logic required

If the channel enters `CHANNEL_ERROR` state repeatedly (e.g., RLS misconfiguration), it will
retry. Log but do not crash. The 30-second polling can remain as a fallback while Realtime is
being established.

### Session Refresh

Supabase Realtime subscriptions require a valid JWT. The `@supabase/ssr` browser client
automatically refreshes the JWT using the cookie-based session. No manual token refresh needed.

The existing `middleware.ts` already handles session refresh on every request.

### Visibility-Based Optimization

Match the existing pattern — pause expensive operations when the tab is hidden:

```typescript
// Optional: pause subscription when tab hidden, resume when visible
// Supabase Realtime already handles disconnection gracefully on tab background.
// The client reconnects when the tab becomes active again.
// No extra code needed — this is automatic.
```

---

## Tables That Require Realtime Enabled

Supabase requires explicit replication publication for each table in the Supabase Dashboard
(Database > Replication > supabase_realtime publication).

Tables to enable for this feature:

| Table | Why | Events |
|-------|-----|--------|
| `appointments` | Primary real-time target | INSERT, UPDATE, DELETE |
| `confirmation_workflows` | Workflow state changes (once migration 004-011 applied) | UPDATE |

**Not needed** (queried via API, not directly subscribed):
- `analytics` aggregations — computed server-side, trigger re-fetch on appointment change
- `waitlist_entries` — relevant for waitlist page only, add later if needed

---

## Supabase Realtime: Feature Used

**Postgres Changes** — not Broadcast, not Presence.

This is the correct choice because:
- Changes originate from server-side DB writes (Twilio webhook handlers)
- The client needs to observe DB state changes, not communicate peer-to-peer
- Broadcast is for client-to-client; Presence is for online state — neither applies here

---

## Build Order (Dependencies Between Components)

Build in this sequence because each step depends on the previous:

```
Step 1: Enable Realtime on "appointments" table
  → Required before any subscription works
  → Done in Supabase Dashboard (zero code)

Step 2: Verify RLS policies cover appointments table
  → Required for secure multi-tenant filtering
  → Existing policies should already cover this; verify during migration fix

Step 3: Create useRealtimeAppointments hook
  → src/hooks/use-realtime-appointments.ts
  → Depends on: Supabase table replication enabled (Step 1), tenantId available
  → Replaces the 30-second polling interval entirely

Step 4: Wire hook into OperationalDashboard
  → Replace fetchAll + setInterval with hook
  → Depends on: hook (Step 3), tenantId from useTenant()

Step 5: Wire hook into AppointmentsPage
  → Same hook, different consumer
  → Depends on: hook (Step 3)

Step 6: Add toast notification layer
  → Small utility component, reads lastEvent from hook
  → Can use a toast library (Sonner — already compatible with shadcn)
  → Depends on: hook (Step 3)

Step 7: Enable sound notification (optional)
  → Browser Audio API, triggers on lastEvent
  → Depends on: toast layer (Step 6)
```

Steps 1-2 are prerequisites (zero-code, config only). Steps 3-6 are the implementation.
Step 3 (the hook) is the critical path — everything else flows from it.

---

## What NOT to Build

| Pattern | Why Avoid |
|---------|-----------|
| Global Realtime Context Provider in `(app)/layout.tsx` | Subscribes on all routes including Settings/Billing/Docs. Wastes connections. |
| Separate channel per appointment ID | Creates N channels for N appointments. Hits channel limits fast. One table subscription is enough. |
| Manual JWT token passing to Realtime | `@supabase/ssr` browser client handles this automatically via cookie session. |
| Custom WebSocket server on Vercel | Vercel is serverless. Impossible to maintain persistent connections. Supabase Realtime exists precisely to solve this. |
| Polling as the primary mechanism after Realtime is live | Keep as fallback only (or remove entirely). Polling + Realtime together cause duplicate state updates. |
| `router.refresh()` on every realtime event | Triggers full server re-render and HTTP round-trip. Defeats the sub-2s latency goal. |

---

## Scalability Notes for This Use Case

Small medical clinics: 2-5 concurrent staff, <100 appointments/day, one tenant per deployment.

| Concern | At Current Scale | Notes |
|---------|-----------------|-------|
| WebSocket connections | 2-5 per clinic | Well within 200 free tier limit |
| Realtime events/second | <1/sec typical | No throughput concern |
| RLS check overhead | Negligible | Simple `tenant_id = auth.jwt()` policies are fast |
| Channel count | 1 per user session | Zero concern |

This architecture does not need horizontal scaling considerations. It is over-engineered for a
multi-region setup. Keep it simple.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Subscription location (hook, not provider) | HIGH | Matches official Supabase Next.js patterns, fits existing codebase structure |
| Server vs Client Component split | HIGH | Realtime is browser-only; all dashboard pages already "use client" |
| Data flow (webhook → DB → Realtime → UI) | HIGH | Standard Supabase Realtime Postgres Changes flow, well documented |
| Multi-tenant RLS filtering | HIGH | Supabase applies RLS to Realtime automatically; verified in official docs |
| Channel naming convention | MEDIUM | Pattern is conventional, not officially mandated |
| State merge pattern (delta vs full refresh) | HIGH | Fits existing useState pattern, no new dependencies |
| Connection lifecycle (subscribe/cleanup/reconnect) | HIGH | Supabase client handles reconnect automatically; cleanup pattern is standard React |

---

## Sources

- [Supabase Realtime with Next.js — official guide](https://supabase.com/docs/guides/realtime/realtime-with-nextjs)
- [Supabase Postgres Changes — official docs](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [Realtime RLS blog post](https://supabase.com/blog/realtime-row-level-security-in-postgresql)
- [Supabase + Vercel integration](https://supabase.com/blog/using-supabase-with-vercel)
- [React Strict Mode + Supabase cleanup issue](https://github.com/supabase/realtime-js/issues/169)
- [Auto reconnect discussion](https://github.com/orgs/supabase/discussions/27513)
- [TooManyChannels troubleshooting](https://supabase.com/docs/guides/troubleshooting/realtime-too-many-channels-error)
- Codebase inspection: `src/lib/supabase/client.ts`, `src/hooks/use-tenant.ts`,
  `src/components/dashboard/operational-dashboard.tsx`, `src/app/(app)/appointments/page.tsx`,
  `src/app/(app)/layout.tsx`
