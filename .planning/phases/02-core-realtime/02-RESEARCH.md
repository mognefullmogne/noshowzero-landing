# Phase 2: Core Realtime - Research

**Researched:** 2026-03-03
**Domain:** Supabase Realtime postgres_changes, React subscription hooks, toast notifications, multi-tenant security
**Confidence:** HIGH

## Summary

Phase 2 replaces the 30-second polling loops in three views (AppointmentsPage, OperationalDashboard, CalendarPage) with Supabase Realtime WebSocket subscriptions to the `appointments` table. Phase 1 already completed the prerequisites: the `appointments` table is in the `supabase_realtime` publication with `REPLICA IDENTITY FULL`, and RLS policies enforce tenant isolation via `tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())`.

The core deliverable is a single custom hook (`useRealtimeAppointments`) that subscribes to `postgres_changes` on the `appointments` table, receives INSERT/UPDATE/DELETE events filtered by RLS, and performs delta-merge into existing React state. This hook replaces `setInterval` polling in all three views. Additionally, Sonner toast notifications fire when appointments are confirmed, and tenant-scoped subscriptions are enforced by the existing RLS policies (no additional client-side filtering needed -- Supabase's WALRUS mechanism evaluates each subscriber's RLS policies server-side before broadcasting events).

The webhook route (`/api/webhooks/twilio/route.ts`) writes via `createServiceClient()` (service_role, bypasses RLS). These writes trigger Realtime events that are then filtered per-subscriber by RLS. This is the correct architecture: all sources of status changes (WhatsApp, SMS, cron, manual dashboard) write to the same `appointments` table, and Realtime broadcasts to authorized subscribers automatically.

**Primary recommendation:** Build a single `useRealtimeAppointments` hook using `supabase.channel().on('postgres_changes', ...).subscribe()` with `supabase.removeChannel()` cleanup. Use the subscribe-first-then-fetch pattern to avoid missing events during initial load. Add Sonner via shadcn/ui for toast notifications. No new RLS policies or server-side changes needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RT-01 | Appointments list updates within 1-2s on status change | `useRealtimeAppointments` hook receives postgres_changes events via WebSocket. Supabase Realtime delivers within ~100-500ms. Delta-merge into React state triggers re-render immediately. |
| RT-02 | Dashboard KPI cards update in real-time | OperationalDashboard wires into the same hook. KPI counts (today, pending, urgent) are recomputed from the appointments array on each state update. |
| RT-03 | Calendar view reflects status changes in real-time | CalendarPage uses the hook to receive updates and merge changed appointments into the grid. STATUS_COLORS map drives visual update without full re-render. |
| RT-06 | 30-second polling replaced by Realtime subscriptions | Remove `setInterval` loops from AppointmentsPage (30s), OperationalDashboard (30s), and CalendarPage (15s). Replace with `useRealtimeAppointments` hook. |
| RT-07 | Multi-channel sync -- all sources trigger same real-time update | All status change sources (WhatsApp webhook via service_role, dashboard PATCH via user session, cron jobs) write to the same `appointments` table. Supabase Realtime broadcasts all changes. No code changes needed for this requirement -- it works by design. |
| SEC-01 | Realtime subscriptions are tenant-scoped | Supabase WALRUS evaluates each subscriber's RLS policy before broadcasting. The `appointments` table has a `FOR ALL` policy: `tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())`. Each user only receives their tenant's events. No additional client-side filtering needed. |
| SEC-02 | service_role key never exposed in client-side code | The browser client uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (via `createBrowserClient` in `src/lib/supabase/client.ts`). The service_role key is only used server-side in `createServiceClient()`. No changes needed. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.98.0 | Realtime subscriptions (channel, postgres_changes) | Already installed; provides the Realtime client built into the Supabase JS SDK |
| @supabase/ssr | ^0.9.0 | Browser client creation (createBrowserClient) | Already installed; provides the authenticated client whose JWT drives RLS evaluation |
| sonner | ^2.0.7 | Toast notifications (confirmation alerts) | Lightweight, zero-config, shadcn/ui blessed component; replaces need for custom notification system |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react | 19.2.3 | useCallback, useEffect, useRef, useState for hook | Already installed; hooks for subscription lifecycle |
| next | 16.1.6 | App Router layout for Toaster placement | Already installed; root layout hosts the Toaster component |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom useRealtimeAppointments | TanStack Query + invalidation | REQUIREMENTS.md explicitly says "TanStack Query integration" is out of scope; existing useState pattern sufficient |
| Sonner | react-hot-toast, react-toastify | Sonner is the shadcn/ui blessed choice; smaller bundle; project already uses shadcn components |
| Delta-merge in hook | Full re-fetch on each event | Delta-merge avoids API calls; REPLICA IDENTITY FULL provides complete row data in events |

**Installation:**
```bash
npx shadcn@latest add sonner
```
This installs the `sonner` package and creates `src/components/ui/sonner.tsx` wrapper. No other new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  hooks/
    use-tenant.ts                      # Existing -- provides tenant context
    use-realtime-appointments.ts       # NEW -- core Realtime subscription hook
  components/
    ui/
      sonner.tsx                       # NEW (auto-generated by shadcn) -- Toaster wrapper
    dashboard/
      operational-dashboard.tsx        # MODIFIED -- wire in hook, remove polling
  app/
    (app)/
      appointments/page.tsx            # MODIFIED -- wire in hook, remove polling
      calendar/page.tsx                # MODIFIED -- wire in hook, remove polling
    layout.tsx                         # MODIFIED -- add <Toaster /> component
```

### Pattern 1: Subscribe-First-Then-Fetch (Race Condition Prevention)
**What:** Subscribe to the Realtime channel first, then fetch initial data. Any events that arrive between subscribe and fetch completion are queued and applied after the initial state is set.
**When to use:** Always, when combining Realtime subscriptions with initial data fetching.
**Why:** If you fetch first then subscribe, events that occur between the fetch completing and the subscription activating are lost. The subscribe-first approach ensures zero missed events.
**Example:**
```typescript
// Source: Supabase community best practice
function useRealtimeAppointments(tenantId: string | undefined) {
  const [appointments, setAppointments] = useState<readonly Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const pendingEventsRef = useRef<RealtimePostgresChangesPayload[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!tenantId) return;

    const supabase = createClient();
    initializedRef.current = false;
    pendingEventsRef.current = [];

    // 1. Subscribe FIRST
    const channel = supabase
      .channel(`appointments:${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          if (!initializedRef.current) {
            // Queue events until initial fetch completes
            pendingEventsRef.current.push(payload);
            return;
          }
          // Apply delta-merge
          setAppointments(prev => applyDelta(prev, payload));
        }
      )
      .subscribe();

    // 2. THEN fetch initial data
    async function fetchInitial() {
      const { data } = await supabase
        .from('appointments')
        .select('*, patient:patients(*)')
        .eq('tenant_id', tenantId)
        .order('scheduled_at', { ascending: false });

      setAppointments(data ?? []);
      setLoading(false);

      // 3. Apply any queued events
      initializedRef.current = true;
      for (const event of pendingEventsRef.current) {
        setAppointments(prev => applyDelta(prev, event));
      }
      pendingEventsRef.current = [];
    }
    fetchInitial();

    // 4. Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  return { appointments, loading };
}
```

### Pattern 2: Immutable Delta-Merge
**What:** Apply INSERT/UPDATE/DELETE events to existing state immutably, creating new arrays without mutating the existing one.
**When to use:** In the Realtime event handler callback.
**Why:** Project coding guidelines require immutability. React needs a new array reference to detect state changes and trigger re-render.
**Example:**
```typescript
// Source: Derived from project coding guidelines + Supabase payload format
function applyDelta(
  current: readonly Appointment[],
  payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }
): readonly Appointment[] {
  switch (payload.eventType) {
    case 'INSERT': {
      const newRow = payload.new as Appointment;
      // Avoid duplicates (idempotent)
      if (current.some(a => a.id === newRow.id)) return current;
      return [newRow, ...current];
    }
    case 'UPDATE': {
      const updated = payload.new as Appointment;
      const index = current.findIndex(a => a.id === updated.id);
      if (index === -1) return [...current, updated]; // Wasn't in view, add it
      // Create new array with updated item (immutable)
      return current.map(a => a.id === updated.id ? { ...a, ...updated } : a);
    }
    case 'DELETE': {
      const deleted = payload.old as { id: string };
      return current.filter(a => a.id !== deleted.id);
    }
    default:
      return current;
  }
}
```

### Pattern 3: Toast Notification on Confirmation
**What:** Fire a Sonner toast when an UPDATE event changes status to 'confirmed'.
**When to use:** Inside the Realtime event handler, after delta-merge.
**Example:**
```typescript
import { toast } from 'sonner';

// Inside the postgres_changes callback:
if (payload.eventType === 'UPDATE') {
  const newRow = payload.new as Appointment;
  const oldRow = payload.old as Partial<Appointment>;
  if (newRow.status === 'confirmed' && oldRow.status !== 'confirmed') {
    toast.success(`Appuntamento confermato`, {
      description: newRow.service_name,
      duration: 4500,
    });
  }
}
```

### Pattern 4: Channel Naming for Tenant Isolation
**What:** Use tenant-specific channel names to logically separate subscriptions.
**When to use:** Always, for multi-tenant apps.
**Why:** While RLS provides the actual security filtering, unique channel names prevent WebSocket multiplexing confusion and make debugging easier.
**Example:**
```typescript
const channel = supabase.channel(`appointments:${tenantId}`);
```
Note: The channel name is purely a client-side label. Security is enforced by RLS, not the channel name. Two tenants could theoretically use the same channel name and still only see their own data. But unique names are a best practice for clarity.

### Anti-Patterns to Avoid
- **Polling AND subscribing:** Remove ALL `setInterval` / `setTimeout` polling code when adding Realtime. Having both creates duplicate data paths and wastes resources (RT-06 explicitly requires this).
- **Mutating state in event handler:** Always return new arrays from `setAppointments`. Never `.push()` or `.splice()` on existing arrays.
- **Using `filter` parameter for tenant_id:** Do NOT add `filter: 'tenant_id=eq.{id}'` to the subscription. RLS handles tenant scoping server-side. Adding a client-side filter is redundant and limits the subscription to only exact-match events, which can miss events where the filter column is not in the changed fields.
- **Creating channels in render path:** Always create channels inside `useEffect`, never in the component body or `useMemo`. Channel creation has side effects.
- **Forgetting cleanup:** Always call `supabase.removeChannel(channel)` in the useEffect cleanup function. Leaked channels accumulate and degrade Realtime service performance.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast component with CSS animations | Sonner (shadcn/ui component) | Handles stacking, auto-dismiss, position, accessibility, animations. Deceptively complex to build correctly. |
| WebSocket management | Custom WebSocket with reconnection logic | Supabase Realtime client | Built into @supabase/supabase-js; handles connection lifecycle, heartbeat, reconnection. Phase 3 will add resilience on top. |
| Tenant filtering of events | Client-side `.filter()` on received events | Supabase RLS (WALRUS) | Server-side evaluation is secure; client-side filtering is a security vulnerability (events still arrive, just hidden). |
| State synchronization | Custom event bus or Redux store | React useState + delta-merge | The hook pattern with immutable state updates is sufficient for this use case. REQUIREMENTS.md explicitly excludes TanStack Query. |
| Real-time KPI computation | Server-side aggregation endpoint | Client-side recomputation from appointments array | For 2-5 staff users and small appointment volumes, recomputing counts from the local state is instant and avoids an extra API call. |

**Key insight:** Supabase Realtime handles the hard parts (WebSocket lifecycle, RLS evaluation, event delivery). The application code only needs to: subscribe, receive events, merge into state, render. No custom WebSocket, no event bus, no state management library.

## Common Pitfalls

### Pitfall 1: Missing Patient Join Data in Realtime Events
**What goes wrong:** The Realtime payload for an UPDATE event contains only the raw `appointments` row columns (id, tenant_id, patient_id, status, etc.). It does NOT include the joined `patient` object that the REST API returns with `select("*, patient:patients(*)")`. Dashboard views that display patient names will show "Unknown" or crash when receiving a Realtime event.
**Why it happens:** Supabase Realtime streams the raw WAL change, not a query result. There is no JOIN capability in the Realtime payload.
**How to avoid:** The delta-merge function must preserve the existing `patient` field from the current state when merging an UPDATE event. Only overwrite the fields that actually changed:
```typescript
case 'UPDATE': {
  const updated = payload.new as Appointment;
  return current.map(a =>
    a.id === updated.id
      ? { ...a, ...updated, patient: a.patient } // Preserve joined patient
      : a
  );
}
```
For INSERT events where the patient is not in state, either: (a) accept that the patient name won't be available until the next full fetch, or (b) do a single lazy fetch of the patient data.
**Warning signs:** Patient name shows as "Unknown" or `undefined` after a Realtime update. The appointment row data is correct but the nested patient object is missing.

### Pitfall 2: React Strict Mode Double Subscription
**What goes wrong:** In development mode with React Strict Mode, `useEffect` runs twice. This creates two Realtime channels, leading to duplicate events and potential CLOSED status on the first subscription.
**Why it happens:** React 18+ Strict Mode intentionally double-invokes effects to detect side-effect bugs.
**How to avoid:** The cleanup function (`supabase.removeChannel(channel)`) properly handles this -- the first subscription is cleaned up, and the second one persists. Ensure cleanup is robust and does not throw if the channel is already removed. This is a development-only issue; production builds do not double-invoke effects.
**Warning signs:** Duplicate events in development mode; "CLOSED" status logged immediately after "SUBSCRIBED".

### Pitfall 3: Dashboard KPI Recomputation from Partial Data
**What goes wrong:** The OperationalDashboard currently fetches KPI data from `/api/dashboard` (which runs server-side queries with date filters, counts, etc.). Simply replacing this with the appointments array from the Realtime hook won't give the same data, because the hook only has the appointments currently in the user's view, not all appointments.
**Why it happens:** The dashboard needs aggregate counts (today's total, this week's total, pending count) across ALL appointments, not just the ones visible in a list view.
**How to avoid:** Two approaches, choose one:
  - **Approach A (recommended):** Keep the initial REST fetch to `/api/dashboard` for KPI data, then use Realtime events to incrementally adjust counts (e.g., if a status changes from 'reminder_sent' to 'confirmed', decrement pendingCount).
  - **Approach B:** Re-fetch `/api/dashboard` when a Realtime event arrives (simpler but adds latency and API load). Since the user base is tiny (2-5 staff), this is acceptable.
**Warning signs:** KPI counts don't match actual database state; counts only reflect appointments visible in the current page.

### Pitfall 4: Sonner Toaster Not Rendered
**What goes wrong:** Calling `toast.success(...)` has no visible effect.
**Why it happens:** The `<Toaster />` component must be rendered in the React tree. If it's missing from the root layout, toasts have nowhere to render.
**How to avoid:** Add `<Toaster />` to `src/app/layout.tsx` (the root layout), not the app layout. This ensures toasts work on all pages.
**Warning signs:** `toast()` calls execute without error but nothing appears on screen.

### Pitfall 5: Calendar View Full Re-Render on Every Event
**What goes wrong:** The CalendarPage recalculates `slotGrid` and `apptGrid` objects on every render. A Realtime event that updates one appointment causes the entire calendar grid to re-render, causing a visible flicker.
**Why it happens:** The grid computation is done inline in the render function, not memoized.
**How to avoid:** Use `useMemo` for the grid computation, keyed on the appointments array reference. Since delta-merge creates a new array, the memo will recompute -- but React's reconciliation will only update the specific DOM nodes that changed (the appointment card whose status changed). The grid structure stays stable.
**Warning signs:** Visible flicker or "flash of re-render" when a single appointment status changes.

### Pitfall 6: Channel Name Collision Across Tabs
**What goes wrong:** If a user opens two browser tabs, both tabs create a channel with the same name (e.g., `appointments:tenant-uuid`). This is actually fine -- Supabase handles multiple channels with the same name from different browser clients independently. Each tab has its own WebSocket connection.
**Why it happens:** N/A -- this is a non-issue, but frequently asked about.
**How to avoid:** No action needed. Each browser tab creates its own Supabase client with its own WebSocket connection. Channel names are scoped to the client instance, not globally.

## Code Examples

Verified patterns from official sources and the existing codebase:

### Supabase Realtime Subscription (Official Pattern)
```typescript
// Source: https://supabase.com/docs/guides/realtime/postgres-changes
const channel = supabase
  .channel('appointments-changes')
  .on(
    'postgres_changes',
    {
      event: '*',        // INSERT, UPDATE, DELETE, or * for all
      schema: 'public',
      table: 'appointments',
      // NOTE: Do NOT add filter for tenant_id -- RLS handles this
    },
    (payload) => {
      console.log('Change received:', payload);
      // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
      // payload.new: the new row (full for INSERT/UPDATE, empty for DELETE)
      // payload.old: the old row (full if REPLICA IDENTITY FULL, else PK only)
      // payload.schema: 'public'
      // payload.table: 'appointments'
    }
  )
  .subscribe((status) => {
    // status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'
    if (status === 'SUBSCRIBED') {
      console.log('Listening to appointment changes');
    }
  });

// Cleanup:
supabase.removeChannel(channel);
```

### Sonner Setup (shadcn/ui Pattern)
```typescript
// src/app/layout.tsx -- add Toaster to root layout
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>
        {children}
        <Toaster position="top-right" richColors visibleToasts={3} />
      </body>
    </html>
  );
}
```

```typescript
// Anywhere in client components:
import { toast } from 'sonner';

toast.success('Appuntamento confermato', {
  description: 'Esame prostata - Stefano Rossi',
  duration: 4500,  // 4.5 seconds auto-dismiss
});
```

### Existing Polling Code to Remove (AppointmentsPage)
```typescript
// src/app/(app)/appointments/page.tsx -- REMOVE this block:
useEffect(() => {
  const poll = setInterval(() => {
    if (document.visibilityState === "visible") {
      fetchAppointments(true);
    }
  }, 30_000);
  return () => clearInterval(poll);
}, [fetchAppointments]);
```

### Existing Polling Code to Remove (OperationalDashboard)
```typescript
// src/components/dashboard/operational-dashboard.tsx -- REMOVE this block:
useEffect(() => {
  const poll = setInterval(() => {
    if (document.visibilityState === "visible") {
      fetchAll(true);
    }
  }, 30_000);
  return () => clearInterval(poll);
}, [fetchAll]);
```

### Existing Polling Code to Remove (CalendarPage)
```typescript
// src/app/(app)/calendar/page.tsx -- REMOVE the interval from this block:
useEffect(() => {
  setLoading(true);
  fetchData();
  const interval = setInterval(fetchData, 15_000);  // REMOVE this
  return () => clearInterval(interval);              // REMOVE this
}, [fetchData]);
// Keep only the fetchData() call for initial load
```

### RLS Policy (Already Applied -- No Changes Needed)
```sql
-- Source: supabase/migrations/002_product_tables.sql (line 145)
-- This policy automatically filters Realtime events per subscriber
CREATE POLICY "Tenant isolation for appointments"
  ON public.appointments FOR ALL
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  );
```

### useTenant Hook (Existing -- Provides tenantId for Channel Naming)
```typescript
// Source: src/hooks/use-tenant.ts
// Returns { tenant, loading, error }
// tenant.id is the tenant UUID used for channel naming
const { tenant } = useTenant();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| setInterval polling (30s/15s) | Supabase Realtime postgres_changes | This phase | Latency drops from 15-30s to <2s; removes unnecessary API calls |
| Manual toast implementation | Sonner (shadcn/ui) | Standard since 2024 | Production-ready toast with stacking, auto-dismiss, accessibility |
| Client-side tenant filtering | Server-side WALRUS (RLS evaluation) | Supabase Realtime v2 (2024) | Events filtered before delivery; no client-side security burden |
| Full state re-fetch on change | Delta-merge from WAL events | This phase | No API call needed for each change; REPLICA IDENTITY FULL provides complete row |

**Deprecated/outdated:**
- `supabase.from('table').on('*', callback)` -- v1 API, removed in v2. Use `supabase.channel().on('postgres_changes', ...)` instead.
- `channel.unsubscribe()` for cleanup -- while functional, `supabase.removeChannel(channel)` is preferred as it fully removes the channel from the client's registry.
- Supabase key naming migration (sb_publishable_*, sb_secret_*) -- per STATE.md, audit env vars. Current `NEXT_PUBLIC_SUPABASE_ANON_KEY` still works; Supabase has not enforced the migration.

## Open Questions

1. **Patient data in Realtime events**
   - What we know: Realtime events contain raw row data without JOINs. The `patient` field will be missing from events.
   - What's unclear: Whether to lazy-fetch patient data for INSERT events or accept "Unknown" until the next full fetch.
   - Recommendation: For UPDATE events, preserve the existing patient from state. For INSERT events, the patient_id is available; lazy-fetch patient data asynchronously if needed. In practice, new appointments created by the same user will already have the patient in state from the creation response. Cross-user inserts (rare for 2-5 staff) can show a loading state briefly.

2. **Dashboard KPI update strategy**
   - What we know: The dashboard needs aggregate counts that can't be computed from a single page's appointment list.
   - What's unclear: Whether the slight data staleness from Approach A (incremental count adjustment) is acceptable vs. Approach B (re-fetch on event).
   - Recommendation: Use Approach B (re-fetch `/api/dashboard` on Realtime event) for simplicity. With 2-5 users and minimal data, the extra API call is negligible. This avoids complex count tracking logic and ensures accuracy.

3. **Supabase key naming deadline**
   - What we know: STATE.md flagged this as a blocker/concern. Supabase planned to migrate to new key names (sb_publishable_*, sb_secret_*) with a Nov 2025 deadline.
   - What's unclear: Whether the old key names still work in March 2026.
   - Recommendation: Test the Realtime subscription with the existing `NEXT_PUBLIC_SUPABASE_ANON_KEY`. If it works, proceed. If not, update the key from the Supabase Dashboard. This is a pre-flight check, not a code change.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None -- no test framework configured in this project |
| Config file | None |
| Quick run command | `npm run build` (TypeScript compilation check) |
| Full suite command | `npm run build` (no test suite exists) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RT-01 | Appointments list updates within 2s on status change | manual-only | Open two browser tabs; change status in one; observe update in other | N/A |
| RT-02 | Dashboard KPIs update in real-time | manual-only | Change appointment status via dashboard; observe KPI card values update | N/A |
| RT-03 | Calendar view updates colors/labels in place | manual-only | Change status; observe calendar cell updates without full re-render | N/A |
| RT-06 | No polling requests in Network tab | manual-only | Open Network tab; wait 60s; verify no recurring /api/appointments requests | N/A |
| RT-07 | Multi-channel sync triggers same update | manual-only | Simulate WhatsApp webhook; observe dashboard update | N/A |
| SEC-01 | Tenant-scoped subscriptions | manual-only | Open app in two different tenant sessions; verify no cross-tenant data | N/A |
| SEC-02 | service_role key not in client code | smoke | `grep -r "SUPABASE_SERVICE_ROLE_KEY" src/ --include="*.ts" --include="*.tsx" | grep -v "server.ts"` | N/A |

**Manual-only justification:**
- RT-01 through RT-07 require a running Supabase instance with Realtime enabled, authenticated browser sessions, and real WebSocket connections. These cannot be unit tested without a full integration test environment (which does not exist in this project).
- SEC-01 requires two authenticated sessions with different tenants -- only testable manually against production/staging.
- The primary automated check is `npm run build` (TypeScript compilation ensures hook interfaces are correct and no import errors exist).

### Sampling Rate
- **Per task commit:** `npm run build` (must pass with 0 TypeScript errors)
- **Per wave merge:** `npm run build` + manual Realtime verification
- **Phase gate:** All 6 success criteria verified manually against the deployed Vercel app

### Wave 0 Gaps
- [ ] `npm install sonner` (or `npx shadcn@latest add sonner`) -- Sonner package not yet installed
- [ ] `src/components/ui/sonner.tsx` -- Toaster component (auto-created by shadcn CLI)
- [ ] No test framework gaps -- this phase relies on manual testing and TypeScript compilation checks

## Sources

### Primary (HIGH confidence)
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) -- subscription API, filter syntax, RLS interaction, payload format
- [Supabase JS subscribe() Reference](https://supabase.com/docs/reference/javascript/subscribe) -- channel lifecycle, status values, removeChannel
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) -- RLS automatic filtering for postgres_changes, no private channel needed
- [Supabase Realtime RLS Blog](https://supabase.com/blog/realtime-row-level-security-in-postgresql) -- WALRUS mechanism, per-subscriber evaluation, performance benchmarks
- [Sonner Official Docs](https://sonner.emilkowal.ski/) -- API, configuration, usage patterns
- [shadcn/ui Sonner Component](https://ui.shadcn.com/docs/components/radix/sonner) -- Installation, Toaster setup, integration
- Existing codebase: `src/lib/supabase/client.ts`, `src/hooks/use-tenant.ts`, `src/app/(app)/appointments/page.tsx`, `src/components/dashboard/operational-dashboard.tsx`, `src/app/(app)/calendar/page.tsx`, `supabase/migrations/002_product_tables.sql`

### Secondary (MEDIUM confidence)
- [Supabase GitHub Discussion #34457](https://github.com/orgs/supabase/discussions/34457) -- unsubscribe vs removeChannel (removeChannel preferred for full cleanup)
- [Supabase GitHub Issue #35282](https://github.com/supabase/supabase/issues/35282) -- RLS + Realtime compatibility confirmed working (issue closed, was misconfiguration)
- [Supabase Realtime JS Issue #169](https://github.com/supabase/realtime-js/issues/169) -- React Strict Mode double subscription (development-only issue, cleanup handles it)

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- @supabase/supabase-js is already installed and the Realtime API is well-documented. Sonner is the shadcn/ui standard for toasts.
- Architecture: HIGH -- subscribe-first-then-fetch and delta-merge are established patterns for Supabase Realtime. RLS tenant scoping is confirmed working by official docs and the WALRUS blog post.
- Pitfalls: HIGH -- Patient join data limitation is a known Realtime constraint. React Strict Mode issue is documented. Dashboard KPI strategy has clear options.

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (Supabase Realtime API is stable; Sonner 2.x is stable)
