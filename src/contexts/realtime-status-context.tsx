// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import type { RealtimeStatus } from "@/lib/realtime/types";

interface RealtimeStatusContextValue {
  readonly realtimeStatus: RealtimeStatus;
  readonly hasActiveSubscription: boolean;
  readonly setRealtimeStatus: (status: RealtimeStatus) => void;
  readonly registerSubscriber: () => () => void;
}

const RealtimeStatusContext = createContext<RealtimeStatusContextValue>({
  realtimeStatus: "CONNECTING",
  hasActiveSubscription: false,
  setRealtimeStatus: () => {},
  registerSubscriber: () => () => {},
});

export function RealtimeStatusProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [realtimeStatus, setRealtimeStatusState] =
    useState<RealtimeStatus>("CONNECTING");
  const [subscriberCount, setSubscriberCount] = useState(0);
  const subscriberCountRef = useRef(0);

  const setRealtimeStatus = useCallback((status: RealtimeStatus) => {
    // Ignore status updates when no subscribers are active (cleanup race)
    if (subscriberCountRef.current > 0) {
      setRealtimeStatusState(status);
    }
  }, []);

  const registerSubscriber = useCallback(() => {
    subscriberCountRef.current += 1;
    setSubscriberCount(subscriberCountRef.current);
    return () => {
      subscriberCountRef.current -= 1;
      setSubscriberCount(subscriberCountRef.current);
    };
  }, []);

  const value = useMemo(
    () => ({
      realtimeStatus,
      hasActiveSubscription: subscriberCount > 0,
      setRealtimeStatus,
      registerSubscriber,
    }),
    [realtimeStatus, subscriberCount, setRealtimeStatus, registerSubscriber],
  );

  return (
    <RealtimeStatusContext.Provider value={value}>
      {children}
    </RealtimeStatusContext.Provider>
  );
}

/** Read the current connection status (used by ConnectionStatus component in layout). */
export function useRealtimeStatus(): {
  readonly status: RealtimeStatus;
  readonly active: boolean;
} {
  const ctx = useContext(RealtimeStatusContext);
  return { status: ctx.realtimeStatus, active: ctx.hasActiveSubscription };
}

/** Push status updates into the context (used by useRealtimeAppointments hook). */
export function useRealtimeStatusSetter(): {
  readonly setStatus: (status: RealtimeStatus) => void;
  readonly register: () => () => void;
} {
  const ctx = useContext(RealtimeStatusContext);
  return { setStatus: ctx.setRealtimeStatus, register: ctx.registerSubscriber };
}
