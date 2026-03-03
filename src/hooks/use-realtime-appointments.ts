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
 * Security: No client-side `filter` on tenant_id -- RLS policies on the
 * `appointments` table handle tenant scoping server-side via WALRUS.
 *
 * Cleanup: Calls `supabase.removeChannel()` (not `unsubscribe`) to fully
 * deregister the channel from the client's internal registry.
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

  // Queue events that arrive before the initial fetch completes
  const pendingEventsRef = useRef<readonly RealtimeAppointmentEvent[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!tenantId) {
      return;
    }

    // Reset for new tenant / re-subscription
    initializedRef.current = false;
    pendingEventsRef.current = [];
    setLoading(true);

    const supabase = createClient();

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
        // Map Supabase enum values to our RealtimeStatus type
        setRealtimeStatus(status as RealtimeStatus);
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

    // ----- 4. CLEANUP -----
    // Use removeChannel (not unsubscribe) for full deregistration
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  return { appointments, loading, realtimeStatus };
}
