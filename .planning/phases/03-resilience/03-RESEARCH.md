# Phase 3: Resilience - Research

**Researched:** 2026-03-03
**Domain:** Supabase Realtime reconnection lifecycle, WebSocket resilience, stale data recovery, connection status UI
**Confidence:** HIGH

## Summary

Phase 3 makes the existing Supabase Realtime subscription (built in Phase 2) survive real-world disruptions: network drops, browser tab backgrounding, and overnight idle sessions. The existing `useRealtimeAppointments` hook already tracks `realtimeStatus` (SUBSCRIBED/TIMED_OUT/CLOSED/CHANNEL_ERROR/CONNECTING) but no view consumes it, and there is no reconnection or stale data recovery logic.

The Supabase Realtime JS client (`@supabase/supabase-js` 2.98.0) includes built-in WebSocket reconnection with exponential backoff (1s, 2s, 5s, 10s) at the transport layer. However, **channel-level** reconnection after a CLOSED or TIMED_OUT status requires application code to detect the failure and re-subscribe. The client also supports two critical resilience features: `worker: true` (offloads heartbeat to a Web Worker to survive browser throttling in background tabs) and `heartbeatCallback` (fires when the heartbeat detects a status change, enabling programmatic reconnection). These are configured on the `createBrowserClient` options under the `realtime` key.

For stale data recovery, the requirements explicitly call for a REST re-fetch (not event replay). The pattern is: detect reconnection (status transitions to SUBSCRIBED after a non-SUBSCRIBED state), then trigger a full data re-fetch to reconcile any missed events during the disconnection period. This is simple and reliable -- no event buffering, no timestamp reconciliation, no complex merge logic.

**Primary recommendation:** Enhance `useRealtimeAppointments` with channel-level reconnection (remove + re-subscribe on CLOSED/TIMED_OUT/CHANNEL_ERROR), add `worker: true` and `heartbeatCallback` to the Supabase client options in `src/lib/supabase/client.ts`, trigger a REST re-fetch on reconnection, and build a `ConnectionStatus` component that reads `realtimeStatus` from the hook and renders in the app layout sidebar header.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RT-04 | Connection state indicator visible to staff (connected / reconnecting / offline) | The `useRealtimeAppointments` hook already exposes `realtimeStatus`. A `ConnectionStatus` component maps SUBSCRIBED -> "Live", CONNECTING -> "Reconnecting", CLOSED/TIMED_OUT/CHANNEL_ERROR -> "Offline". Place in the app layout sidebar header (line 137-146 of `src/app/(app)/layout.tsx`). |
| RT-05 | Automatic reconnection with stale data recovery when WebSocket disconnects and reconnects | Three layers: (1) Transport-level reconnection via Supabase's built-in exponential backoff. (2) Channel-level reconnection by detecting CLOSED/TIMED_OUT/CHANNEL_ERROR and re-subscribing via removeChannel + new channel. (3) Stale data recovery by triggering a full REST re-fetch when status transitions back to SUBSCRIBED after a non-SUBSCRIBED state. Add `worker: true` and `heartbeatCallback` to prevent background tab disconnections. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.98.0 | Realtime WebSocket reconnection, heartbeat, worker support | Already installed; built-in exponential backoff (1s, 2s, 5s, 10s) and heartbeat mechanism (25s interval) |
| @supabase/ssr | ^0.9.0 | createBrowserClient with realtime options | Already installed; passes `realtime: { worker, heartbeatCallback }` options through to the underlying client |
| react | 19.2.3 | useEffect, useRef, useCallback for reconnection lifecycle | Already installed; hooks manage subscription teardown/rebuild |
| lucide-react | ^0.576.0 | Wifi, WifiOff, Loader2 icons for connection indicator | Already installed; consistent with project icon system |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwind-merge / clsx | installed | Conditional styling for connection status badge | Already installed; style transitions between Live/Reconnecting/Offline states |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Built-in Supabase reconnection + manual channel rebuild | Custom WebSocket wrapper | REQUIREMENTS.md explicitly excludes "Custom WebSocket server". Supabase handles transport-level reconnection. We only add channel-level recovery. |
| REST re-fetch on reconnect | Event replay / timestamp reconciliation | Event replay requires server-side event log (not available). REST re-fetch is simple, reliable, and explicitly required by success criteria #3. |
| visibilitychange listener | Service Worker keep-alive | Service Worker is out of scope per REQUIREMENTS.md. `worker: true` + `heartbeatCallback` handles background tabs. |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    supabase/
      client.ts                          # MODIFIED -- add realtime worker + heartbeatCallback options
    realtime/
      types.ts                           # MODIFIED -- add reconnection-related types
      apply-delta.ts                     # UNCHANGED
  hooks/
    use-realtime-appointments.ts         # MODIFIED -- add reconnection logic + stale data recovery
  components/
    shared/
      connection-status.tsx              # NEW -- persistent connection indicator component
  app/
    (app)/
      layout.tsx                         # MODIFIED -- render ConnectionStatus in sidebar header
```

### Pattern 1: Three-Layer Reconnection Architecture
**What:** Resilience is achieved through three distinct layers, each handling a different failure mode.
**When to use:** Always, for production Supabase Realtime applications.

**Layer 1 -- Transport-level (automatic, built-in):**
The Supabase Realtime client automatically reconnects the WebSocket with exponential backoff (1s, 2s, 5s, 10s). This handles brief network blips transparently. No application code needed.

**Layer 2 -- Heartbeat/Worker (configuration, prevents silent disconnections):**
Browser tab throttling can prevent heartbeat signals from being sent, causing silent disconnections. Configuring `worker: true` offloads heartbeats to a Web Worker thread. The `heartbeatCallback` provides a fallback detection mechanism.

**Layer 3 -- Channel-level (application code, handles CLOSED/TIMED_OUT):**
When the channel enters CLOSED, TIMED_OUT, or CHANNEL_ERROR state, the application must explicitly tear down the channel and re-subscribe. This is the only layer requiring custom code.

```typescript
// Source: Supabase troubleshooting docs + community patterns
// https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794

// Layer 2: Configure in createBrowserClient
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        worker: true,
        heartbeatCallback: (status) => {
          if (status === "disconnected") {
            // The Supabase client will auto-reconnect at the transport level.
            // Channel-level recovery is handled in the hook.
            console.warn("[Realtime] Heartbeat disconnected -- transport reconnecting");
          }
        },
      },
    },
  );
}
```

### Pattern 2: Channel-Level Reconnection with Stale Data Recovery
**What:** When the channel status transitions to a failed state, remove the channel, create a new one, and re-fetch all data via REST on successful reconnection.
**When to use:** In the `useRealtimeAppointments` hook's subscribe callback.
**Why:** The Supabase client's automatic transport reconnection does not automatically re-join channels that entered CLOSED or TIMED_OUT. The application must handle this.

```typescript
// Source: Community patterns + Supabase discussions
// https://github.com/orgs/supabase/discussions/27513

// Inside useRealtimeAppointments:
const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const reconnectAttemptRef = useRef(0);
const MAX_RECONNECT_ATTEMPTS = 5;

// In the .subscribe() callback:
.subscribe((status) => {
  setRealtimeStatus(status as RealtimeStatus);

  if (status === "SUBSCRIBED") {
    // Reset reconnect counter on success
    reconnectAttemptRef.current = 0;

    // If this is a RE-subscription (not first connect), re-fetch stale data
    if (hasBeenSubscribedRef.current) {
      // Stale data recovery: full REST re-fetch
      fetchInitial();
    }
    hasBeenSubscribedRef.current = true;
  }

  if (
    status === "CLOSED" ||
    status === "TIMED_OUT" ||
    status === "CHANNEL_ERROR"
  ) {
    // Channel-level reconnection with exponential backoff
    if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptRef.current),
        30_000,
      );
      reconnectAttemptRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        supabase.removeChannel(channel);
        // Re-run the effect by updating a trigger ref/state
      }, delay);
    }
  }
});
```

### Pattern 3: Reconnection Trigger via Effect Dependency
**What:** Use a `reconnectTrigger` state counter to force the useEffect to re-run, which tears down the old channel and creates a new one.
**When to use:** When channel-level reconnection is needed without unmounting the component.
**Why:** The useEffect cleanup function calls `removeChannel()`, and the re-run creates a fresh channel. This reuses the existing subscribe-first-then-fetch pattern.

```typescript
const [reconnectTrigger, setReconnectTrigger] = useState(0);

useEffect(() => {
  if (!tenantId) return;
  // ... existing subscribe-first-then-fetch logic ...

  const channel = supabase
    .channel(`appointments:${tenantId}`)
    .on("postgres_changes", /* ... */)
    .subscribe((status) => {
      // ... status handling ...
      if (shouldReconnect) {
        // Schedule reconnection
        const timer = setTimeout(() => {
          setReconnectTrigger((prev) => prev + 1);
        }, backoffDelay);
        return () => clearTimeout(timer);
      }
    });

  return () => {
    supabase.removeChannel(channel);
    // Clear any pending reconnection timers
  };
}, [tenantId, reconnectTrigger]); // <-- reconnectTrigger forces re-run
```

### Pattern 4: Connection Status Component
**What:** A small, persistent badge that displays real-time connection state using the `realtimeStatus` from the hook.
**When to use:** In the app sidebar header, visible on all dashboard pages.
**Why:** RT-04 requires staff to always see if they are live or offline. The indicator must never show "Live" when the channel is not SUBSCRIBED (success criteria #4).

```typescript
// Mapping from RealtimeStatus to user-visible state
const STATUS_MAP = {
  SUBSCRIBED: { label: "Live", color: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-500", animate: true },
  CONNECTING: { label: "Riconnessione...", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500", animate: true },
  TIMED_OUT: { label: "Offline", color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500", animate: false },
  CLOSED: { label: "Offline", color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500", animate: false },
  CHANNEL_ERROR: { label: "Offline", color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500", animate: false },
} as const;
```

### Anti-Patterns to Avoid
- **Infinite reconnection loops:** Without a maximum attempt count or increasing backoff, failed reconnections can create tight loops that hammer the server and drain battery. Use exponential backoff with a max of 5 attempts, then stop and show "Offline".
- **Reconnecting without removing the old channel:** Calling `.subscribe()` on a CLOSED channel does not work. You MUST call `supabase.removeChannel(channel)` first, then create a new channel. The old channel is dead.
- **Showing "Live" during reconnection:** The indicator must map ONLY `SUBSCRIBED` to "Live". All other states (including `CONNECTING`) must show a non-live state. Success criteria #4 explicitly tests this.
- **Event replay after reconnect:** Do NOT attempt to replay events from the disconnection period. REST re-fetch is the correct recovery strategy (success criteria #3).
- **Multiple Supabase client instances for reconnection:** Do NOT create a new `createClient()` for each reconnection attempt. Reuse the existing client; only recreate the channel.
- **Skipping cleanup of reconnection timers:** If the component unmounts during a pending reconnection timeout, the timer must be cleared to prevent state updates on unmounted components.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket transport reconnection | Custom WebSocket with reconnection | Supabase built-in exponential backoff | Built into the client (1s, 2s, 5s, 10s). Handles heartbeat, keepalive, and transport-level reconnection automatically. |
| Background tab heartbeat survival | setInterval-based heartbeat | `worker: true` option on Supabase client | Web Worker runs in a separate thread, immune to browser throttling. The default worker URL (realtime.supabase.com/worker.js) handles keepalive. |
| Connection health monitoring | Custom ping/pong mechanism | `heartbeatCallback` on Supabase client | Fires with 'ok', 'timeout', 'disconnected' statuses. Integrates with the client's 25-second heartbeat interval. |
| Stale data reconciliation | Event replay / timestamp-based merge | Full REST re-fetch on reconnect | No server-side event log available. REST re-fetch is simple, accurate, and explicitly required by the success criteria. |
| Online/offline detection | Custom navigator.onLine polling | Supabase channel status callback | The `.subscribe()` status callback already fires CLOSED/CHANNEL_ERROR on network loss and SUBSCRIBED on recovery. |

**Key insight:** The Supabase Realtime client handles 80% of resilience automatically at the transport layer. Phase 3 only needs to add: (a) channel-level recovery for the 20% of cases where transport recovery succeeds but the channel does not auto-rejoin, (b) stale data re-fetch, and (c) a UI indicator. This is a thin layer of application code on top of robust infrastructure.

## Common Pitfalls

### Pitfall 1: Browser Tab Throttling Kills Heartbeats
**What goes wrong:** When the browser tab is backgrounded (user switches tabs, minimizes browser), modern browsers throttle JavaScript timers to 1-minute intervals. The Supabase heartbeat (25s default) misses its window, and the server closes the connection after detecting no heartbeat response.
**Why it happens:** Chrome, Firefox, and Safari all implement timer throttling for background tabs to save battery and CPU. This is not a bug -- it's browser behavior.
**How to avoid:** Set `worker: true` in the Supabase client's realtime options. This moves heartbeat logic to a Web Worker, which runs in a separate thread unaffected by tab throttling. This is the primary prevention mechanism.
**Warning signs:** Connection drops ~30-60 seconds after switching tabs. Status transitions to TIMED_OUT or CLOSED without any network issue.

### Pitfall 2: Channel CLOSED State Is Terminal
**What goes wrong:** After a disconnection, the channel enters CLOSED state. Developers attempt to call `.subscribe()` again on the same channel object, which silently fails or creates an oscillating SUBSCRIBED/CLOSED loop.
**Why it happens:** Once a channel enters CLOSED state in the Supabase Realtime client, it cannot be reused. The internal state machine does not support transitioning from CLOSED back to a subscribable state.
**How to avoid:** Always call `supabase.removeChannel(channel)` on the dead channel, then create a brand new channel with `supabase.channel(name)`. The cleanest way in React is to use a `reconnectTrigger` state that forces the useEffect to re-run (cleanup removes old channel, setup creates new one).
**Warning signs:** Rapid SUBSCRIBED -> CLOSED oscillation in console logs. Channel status never stabilizes.

### Pitfall 3: Stale Data Window During Reconnection
**What goes wrong:** Events that occur while the WebSocket is disconnected are permanently lost. After reconnection, the local state is stale -- it reflects the state at the moment of disconnection, not the current server state.
**Why it happens:** Supabase Realtime is a live stream, not a persistent queue. Events are not stored server-side for replay. Once the connection drops, any events during the gap are gone.
**How to avoid:** On successful reconnection (status transitions to SUBSCRIBED after being in a failed state), trigger a full REST re-fetch of the data. This brings the local state up to date. Use the same `fetchInitial()` function that runs on component mount.
**Warning signs:** After reconnecting, the dashboard shows appointment statuses that are outdated compared to the actual database state.

### Pitfall 4: Multiple Reconnection Timers Accumulating
**What goes wrong:** Each CLOSED/TIMED_OUT status callback fires and schedules a reconnection timeout. If the status fires multiple times before the first timeout completes, multiple competing timers are created, leading to rapid-fire reconnection attempts.
**Why it happens:** The `.subscribe()` status callback can fire CLOSED and then TIMED_OUT in sequence, or fire CHANNEL_ERROR multiple times.
**How to avoid:** Store the timeout ID in a ref and clear any existing timeout before scheduling a new one. Also track whether a reconnection is already in progress with a boolean ref.
**Warning signs:** Console logs show multiple simultaneous reconnection attempts. Network tab shows burst of WebSocket connection attempts.

### Pitfall 5: Hardcoded "Live" Badge in Dashboard
**What goes wrong:** The operational dashboard currently has a hardcoded "Aggiornamento live" badge (line 246-249 of `operational-dashboard.tsx`) that always shows green regardless of actual connection state. Staff see "Live" even when disconnected.
**Why it happens:** The badge was added in Phase 2 as a static visual indicator, before connection state management was implemented.
**How to avoid:** Replace the hardcoded badge with the new `ConnectionStatus` component that reads actual `realtimeStatus`. Remove the static badge entirely.
**Warning signs:** Dashboard shows "Live" while DevTools Network shows the WebSocket is closed.

### Pitfall 6: Reconnection After Auth Token Expiry
**What goes wrong:** After a long disconnection (overnight clinic session), the Supabase auth token may have expired. The reconnection attempt creates a new channel, but the RLS policies reject it because the JWT is no longer valid.
**Why it happens:** Supabase access tokens have a default expiry of 1 hour. After overnight idle, the token is expired. The Supabase client auto-refreshes tokens for HTTP requests but the Realtime client may not pick up the refreshed token for new channel subscriptions.
**How to avoid:** Before creating a new channel on reconnection, call `supabase.auth.getSession()` to trigger a token refresh. The `createBrowserClient` from `@supabase/ssr` handles cookie-based session management, but an explicit session check ensures the token is fresh before subscribing.
**Warning signs:** Reconnection attempt results in CHANNEL_ERROR. Server logs show RLS policy violation or unauthorized error.

## Code Examples

### Supabase Client with Resilience Options
```typescript
// Source: Supabase official troubleshooting docs
// https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794

// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        worker: true,
        heartbeatCallback: (status) => {
          if (status === "disconnected") {
            console.warn("[Realtime] Heartbeat detected disconnection");
          }
        },
      },
    },
  );
}
```

### Existing Dashboard Badge to Replace
```typescript
// Source: src/components/dashboard/operational-dashboard.tsx lines 246-249
// REMOVE this hardcoded badge:
<span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
  Aggiornamento live
</span>
// REPLACE with: <ConnectionStatus realtimeStatus={realtimeStatus} />
```

### Existing Hook Return Value (Already Has realtimeStatus)
```typescript
// Source: src/hooks/use-realtime-appointments.ts line 164
return { appointments, loading, realtimeStatus };
// realtimeStatus is already exposed but unused by any view
```

### Connection Status Component Pattern
```typescript
// Source: Derived from project patterns + Supabase status values
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RealtimeStatus } from "@/lib/realtime/types";

interface ConnectionStatusProps {
  readonly realtimeStatus: RealtimeStatus;
}

const STATUS_CONFIG = {
  SUBSCRIBED: {
    label: "Live",
    icon: Wifi,
    className: "text-green-700 bg-green-50 border-green-200",
    dotClassName: "bg-green-500 animate-pulse",
  },
  CONNECTING: {
    label: "Riconnessione...",
    icon: Loader2,
    className: "text-amber-700 bg-amber-50 border-amber-200",
    dotClassName: "bg-amber-500 animate-pulse",
  },
  TIMED_OUT: {
    label: "Offline",
    icon: WifiOff,
    className: "text-red-700 bg-red-50 border-red-200",
    dotClassName: "bg-red-500",
  },
  CLOSED: {
    label: "Offline",
    icon: WifiOff,
    className: "text-red-700 bg-red-50 border-red-200",
    dotClassName: "bg-red-500",
  },
  CHANNEL_ERROR: {
    label: "Offline",
    icon: WifiOff,
    className: "text-red-700 bg-red-50 border-red-200",
    dotClassName: "bg-red-500",
  },
} as const;

export function ConnectionStatus({ realtimeStatus }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[realtimeStatus];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium rounded-full border px-3 py-1",
        config.className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClassName)} />
      {config.label}
    </span>
  );
}
```

### App Layout Integration Point
```typescript
// Source: src/app/(app)/layout.tsx lines 137-146
// The ConnectionStatus component goes in the sidebar header, next to the logo:
<div className="flex h-16 items-center gap-2 border-b border-black/[0.04] px-6">
  <Link href="/dashboard" className="flex items-center gap-2">
    {/* ... logo ... */}
  </Link>
  {/* Add ConnectionStatus here, pushed to the right */}
  <div className="ml-auto">
    <ConnectionStatus realtimeStatus={realtimeStatus} />
  </div>
</div>
```

### Visibility Change + Reconnection Pattern
```typescript
// Source: Community pattern from https://github.com/orgs/supabase/discussions/5641
// Combined with Supabase official heartbeatCallback approach

// Inside the useRealtimeAppointments effect:
const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    // Tab became visible -- check if we need to reconnect
    // The heartbeatCallback + worker should prevent most disconnections,
    // but this is a belt-and-suspenders approach
    if (currentStatusRef.current !== "SUBSCRIBED") {
      setReconnectTrigger((prev) => prev + 1);
    }
  }
};
document.addEventListener("visibilitychange", handleVisibilityChange);
// Cleanup: document.removeEventListener("visibilitychange", handleVisibilityChange);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual setInterval heartbeat | `worker: true` Web Worker heartbeat | Supabase troubleshooting docs (2025) | Prevents background tab disconnections without custom code |
| No heartbeat monitoring | `heartbeatCallback` option | Supabase realtime-js (2025) | Enables programmatic reconnection detection |
| Pray and re-subscribe on same channel | removeChannel + new channel | Community best practice | Avoids terminal CLOSED state trap |
| Full page reload to recover | REST re-fetch on reconnect | This phase | Seamless recovery without user intervention |
| Static "Live" badge | Dynamic status indicator from channel state | This phase | Staff always know actual connection state |

**Deprecated/outdated:**
- `channel.unsubscribe()` then `channel.subscribe()` for recovery -- this does NOT work for CLOSED channels. Must use `removeChannel()` + new channel.
- `navigator.onLine` for connection detection -- unreliable (can return true when behind a captive portal or with limited connectivity). Supabase channel status is more accurate.
- Custom WebSocket reconnection wrappers -- the Supabase client's built-in reconnection + `worker` + `heartbeatCallback` covers all cases.

## Open Questions

1. **Web Worker CSP compatibility with Vercel**
   - What we know: `worker: true` loads a script from `https://realtime.supabase.com/worker.js` by default. This requires the CSP to allow this origin as a `worker-src`.
   - What's unclear: Whether Vercel's default CSP headers allow this. If not, we may need to set `workerUrl` to a self-hosted copy or add CSP headers.
   - Recommendation: Test with `worker: true` on the Vercel deployment. If it fails with a CSP error, either add the origin to CSP headers in `next.config.js` or set `workerUrl` to a local copy. If all else fails, `worker: false` with `heartbeatCallback` + `visibilitychange` listener is an acceptable fallback.

2. **Reconnection and App Layout context sharing**
   - What we know: The `ConnectionStatus` component needs `realtimeStatus`, but the hook is called per-page (AppointmentsPage, Dashboard, Calendar). The layout wraps all pages.
   - What's unclear: Whether to lift `useRealtimeAppointments` up to the layout level or create a separate lightweight connection-status hook.
   - Recommendation: The hook is already called in all three views. The simplest approach is to create a thin `useConnectionStatus` hook (or React context) at the layout level that only subscribes to a channel for status monitoring, separate from the data hook. Alternatively, lift the full hook to the layout and pass data down via context. The former is lighter-weight.

3. **Exponential backoff ceiling**
   - What we know: Community patterns use 5 max attempts with exponential backoff (1s, 2s, 4s, 8s, 16s). Supabase's built-in transport backoff caps at 10s.
   - What's unclear: Whether 5 attempts is sufficient for overnight sessions where network may be down for hours.
   - Recommendation: Cap at 5 attempts (31s total), then stop retrying and show "Offline". Add a `visibilitychange` listener that resets the counter and triggers a reconnection attempt when the tab becomes visible again. This handles the "overnight" case without continuous retrying.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None -- no test framework configured in this project |
| Config file | None |
| Quick run command | `npm run build` |
| Full suite command | `npm run build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RT-04 | Connection indicator shows "Live" when SUBSCRIBED, "Reconnecting" when CONNECTING, "Offline" when CLOSED/TIMED_OUT/CHANNEL_ERROR | manual | Open dashboard; verify green "Live" badge. Open DevTools > Network > Offline; verify badge changes to "Offline". Re-enable network; verify badge returns to "Live". | N/A |
| RT-04 | Indicator never shows "Live" when not SUBSCRIBED | manual | Open DevTools > Console; monitor realtimeStatus. Verify badge text matches status at all times. Force CHANNEL_ERROR; verify badge shows "Offline" not "Live". | N/A |
| RT-05 | Automatic reconnection after network drop | manual | Open dashboard. DevTools > Network > Offline for 10s. Re-enable. Verify WebSocket reconnects (Network tab shows new WS connection). Verify channel status returns to SUBSCRIBED. | N/A |
| RT-05 | Stale data recovery on reconnect | manual | Open dashboard. DevTools > Network > Offline. In another tab/API client, change an appointment status. Re-enable network in first tab. Verify the status change appears without page reload. | N/A |
| RT-05 | Background tab survival | manual | Open dashboard. Switch to another tab for 30+ seconds. Return. Verify connection is still SUBSCRIBED (or reconnects within a few seconds). Verify data is current. | N/A |

**Manual-only justification:**
- RT-04 and RT-05 require a running Supabase Realtime instance, authenticated browser sessions, actual WebSocket connections, and browser DevTools manipulation (offline mode, tab switching). These cannot be unit tested without a full integration test environment with a real WebSocket server.
- The primary automated check remains `npm run build` (TypeScript compilation ensures type safety of the connection status component, hook modifications, and client configuration changes).

### Sampling Rate
- **Per task commit:** `npm run build` (must pass with 0 TypeScript errors)
- **Per wave merge:** `npm run build` + manual connection resilience verification
- **Phase gate:** All 4 success criteria verified manually against the deployed Vercel app

### Wave 0 Gaps
None -- existing infrastructure covers all phase requirements. No new packages, no new test files, no framework changes needed.

## Sources

### Primary (HIGH confidence)
- [Supabase Troubleshooting: Handling Silent Disconnections](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794) -- `worker: true`, `heartbeatCallback`, Web Worker approach for background tab survival
- [Supabase Troubleshooting: Realtime Heartbeat Messages](https://supabase.com/docs/guides/troubleshooting/realtime-heartbeat-messages) -- Heartbeat mechanism (25s default), `onHeartbeat` method, status values (sent/ok/error/timeout/disconnected), exponential backoff (1s, 2s, 5s, 10s)
- [Supabase realtime-js RealtimeClient.ts source](https://github.com/supabase/realtime-js/blob/master/src/RealtimeClient.ts) -- RECONNECT_INTERVALS = [1000, 2000, 5000, 10000], heartbeatInterval = 25000, worker implementation
- Existing codebase: `src/hooks/use-realtime-appointments.ts` (already exposes realtimeStatus), `src/lib/supabase/client.ts` (createBrowserClient), `src/lib/realtime/types.ts` (RealtimeStatus type), `src/app/(app)/layout.tsx` (sidebar layout), `src/components/dashboard/operational-dashboard.tsx` (hardcoded live badge to replace)

### Secondary (MEDIUM confidence)
- [Supabase Discussion #27513: Auto reconnect after CLOSED](https://github.com/orgs/supabase/discussions/27513) -- CLOSED state is terminal; must removeChannel + create new; exponential backoff pattern
- [Supabase Discussion #5641: Reliable Realtime updates](https://github.com/orgs/supabase/discussions/5641) -- Visibility-based reconnection pattern, RELOAD on SUBSCRIBED, data reconciliation strategy
- [Supabase Discussion #19387: Idle reconnects](https://github.com/orgs/supabase/discussions/19387) -- visibilitychange + subscription status monitoring, query invalidation on reconnect
- [Supabase Discussion #10293: Subscribe to error/timeout events](https://github.com/supabase/supabase/discussions/10293) -- Status callback fires for all lifecycle changes, not just initial subscribe

### Tertiary (LOW confidence)
- [Supabase Realtime Issue #1088: Unable to reconnect after TIMED_OUT](https://github.com/supabase/realtime/issues/1088) -- Reports difficulty reconnecting after TIMED_OUT; may be fixed in current versions but validates need for manual channel-level reconnection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies needed. Supabase client's `worker` and `heartbeatCallback` options are documented in official troubleshooting guides with code examples.
- Architecture: HIGH -- Three-layer reconnection pattern (transport, heartbeat/worker, channel-level) is well-documented across Supabase official docs and community discussions. REST re-fetch for stale data is explicitly required by success criteria.
- Pitfalls: HIGH -- Browser tab throttling, CLOSED state terminality, and stale data windows are well-documented in Supabase issues and discussions. Auth token expiry is a known edge case for long sessions.

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (Supabase Realtime client API is stable; resilience patterns are well-established)
