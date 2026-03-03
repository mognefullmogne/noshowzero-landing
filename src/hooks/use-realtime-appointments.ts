"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { Appointment } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { applyDelta } from "@/lib/realtime/apply-delta";
import type {
  RealtimeAppointmentEvent,
  RealtimeStatus,
  UseRealtimeAppointmentsReturn,
} from "@/lib/realtime/types";
import {
  RECONNECTABLE_STATUSES,
  MAX_RECONNECT_ATTEMPTS,
} from "@/lib/realtime/types";

/**
 * Fire a toast when an appointment transitions to 'confirmed'.
 * Checks both old and new row status to avoid firing on initial loads
 * or non-confirmation updates.
 */
function notifyIfConfirmed(event: RealtimeAppointmentEvent): void {
  if (event.eventType !== "UPDATE") {
    return;
  }
  const newRow = event.new;
  const oldRow = event.old;
  if (newRow.status === "confirmed" && oldRow.status !== "confirmed") {
    toast.success("Appuntamento confermato", {
      description: (newRow.service_name as string) ?? "Appuntamento",
      duration: 4500,
    });
  }
}

/**
 * Subscribes to Supabase Realtime postgres_changes on the `appointments` table
 * and maintains an immutable, always-current appointments array.
 *
 * Uses the subscribe-first-then-fetch pattern to prevent missing events
 * during initial data load (see 02-RESEARCH.md Pattern 1).
 *
 * Reconnection: Channel-level failures (CLOSED, TIMED_OUT, CHANNEL_ERROR)
 * trigger exponential backoff reconnection via the reconnectTrigger pattern.
 * A state counter forces the useEffect to re-run, which naturally tears down
 * the old channel via cleanup and creates a fresh one.
 *
 * Stale data recovery: On successful re-subscription (hasBeenSubscribedRef),
 * a full REST re-fetch replaces the in-memory appointment array to recover
 * any changes missed during the disconnection period.
 *
 * Background tab resilience: The Supabase client uses worker: true for
 * heartbeat survival. A visibilitychange listener resets the reconnect
 * counter and triggers reconnection when returning to a stale tab.
 *
 * Security: No client-side `filter` on tenant_id -- RLS policies on the
 * `appointments` table handle tenant scoping server-side via WALRUS.
 *
 * Cleanup: Calls `supabase.removeChannel()` (not `unsubscribe`) to fully
 * deregister the channel from the client's internal registry. All reconnection
 * timers and visibility listeners are cleared on unmount.
 *
 * @param tenantId - The tenant UUID. Subscription is skipped when undefined.
 */
export function useRealtimeAppointments(
  tenantId: string | undefined,
): UseRealtimeAppointmentsReturn {
  const [appointments, setAppointments] = useState<readonly Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("CONNECTING");

  // Reconnection trigger: incrementing this counter forces useEffect re-run,
  // which tears down old channel via cleanup and creates a fresh subscription
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  // Queue events that arrive before the initial fetch completes
  const pendingEventsRef = useRef<readonly RealtimeAppointmentEvent[]>([]);
  const initializedRef = useRef(false);

  // Reconnection state refs (not state to avoid extra re-renders)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectAttemptRef = useRef(0);
  const hasBeenSubscribedRef = useRef(false);
  const currentStatusRef = useRef<RealtimeStatus>("CONNECTING");

  useEffect(() => {
    if (!tenantId) {
      return;
    }

    // Reset for new tenant / re-subscription
    initializedRef.current = false;
    pendingEventsRef.current = [];
    reconnectAttemptRef.current = 0;
    hasBeenSubscribedRef.current = false;
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setLoading(true);

    const supabase = createClient();

    // Ensure auth token is fresh before subscribing (Pitfall 6: overnight token expiry)
    supabase.auth.getSession();

    // ----- 1. SUBSCRIBE FIRST -----
    // Tenant-specific channel name for logical isolation (Pattern 4).
    // No `filter` parameter -- RLS handles tenant scoping (Anti-Patterns).
    const channel = supabase
      .channel(`appointments:${tenantId}`)
      .on(
        "postgres_changes" as const,
        {
          event: "*" as const,
          schema: "public",
          table: "appointments",
        },
        (payload) => {
          const event: RealtimeAppointmentEvent = {
            eventType: payload.eventType as
              | "INSERT"
              | "UPDATE"
              | "DELETE",
            new: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          };

          if (!initializedRef.current) {
            // Queue events until initial fetch completes
            pendingEventsRef.current = [...pendingEventsRef.current, event];
            return;
          }

          setAppointments((prev) => applyDelta(prev, event));
          notifyIfConfirmed(event);
        },
      )
      .subscribe((status) => {
        const mappedStatus = status as RealtimeStatus;
        setRealtimeStatus(mappedStatus);
        currentStatusRef.current = mappedStatus;

        if (mappedStatus === "SUBSCRIBED") {
          // Reset reconnect counter on success
          reconnectAttemptRef.current = 0;

          // Stale data recovery: if this is a RE-subscription, re-fetch all data
          if (hasBeenSubscribedRef.current) {
            fetchInitial();
          }
          hasBeenSubscribedRef.current = true;
        }

        if (RECONNECTABLE_STATUSES.includes(mappedStatus)) {
          // Channel-level reconnection with exponential backoff
          if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
            // Clear any existing timer to prevent accumulation (Pitfall 4)
            if (reconnectTimeoutRef.current !== null) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttemptRef.current),
              30_000,
            );
            reconnectAttemptRef.current += 1;
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null;
              setReconnectTrigger((prev) => prev + 1);
            }, delay);
          }
        }
      });

    // ----- 2. THEN FETCH initial data -----
    async function fetchInitial(): Promise<void> {
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select("*, patient:patients(*)")
          .eq("tenant_id", tenantId!)
          .order("scheduled_at", { ascending: false });

        if (error) {
          console.error("[useRealtimeAppointments] Initial fetch error:", error);
          setLoading(false);
          return;
        }

        const fetched: readonly Appointment[] = (data ?? []) as Appointment[];
        setAppointments(fetched);
        setLoading(false);

        // ----- 3. Drain queued events -----
        initializedRef.current = true;
        const queued = pendingEventsRef.current;
        pendingEventsRef.current = [];

        if (queued.length > 0) {
          setAppointments((prev) =>
            queued.reduce<readonly Appointment[]>(
              (acc, event) => applyDelta(acc, event),
              prev,
            ),
          );
          // Fire toasts for any confirmations that arrived during initial fetch
          for (const event of queued) {
            notifyIfConfirmed(event);
          }
        }
      } catch (err) {
        console.error(
          "[useRealtimeAppointments] Unexpected fetch error:",
          err,
        );
        setLoading(false);
      }
    }

    fetchInitial();

    // ----- 4. VISIBILITY CHANGE HANDLER -----
    // When tab becomes visible and connection is not live, reset counter and reconnect.
    // Handles the "overnight" case: after max attempts exhausted, returning to
    // the tab resets the counter and tries again.
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        currentStatusRef.current !== "SUBSCRIBED"
      ) {
        reconnectAttemptRef.current = 0;
        setReconnectTrigger((prev) => prev + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // ----- 5. CLEANUP -----
    // Use removeChannel (not unsubscribe) for full deregistration.
    // Clear reconnection timers and visibility listener to prevent leaks.
    return () => {
      supabase.removeChannel(channel);
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [tenantId, reconnectTrigger]);

  return { appointments, loading, realtimeStatus };
}
