"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { RealtimeStatus } from "@/lib/realtime/types";

interface RealtimeStatusContextValue {
  readonly realtimeStatus: RealtimeStatus;
  readonly setRealtimeStatus: (status: RealtimeStatus) => void;
}

const RealtimeStatusContext = createContext<RealtimeStatusContextValue>({
  realtimeStatus: "CONNECTING",
  setRealtimeStatus: () => {},
});

export function RealtimeStatusProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [realtimeStatus, setRealtimeStatusState] =
    useState<RealtimeStatus>("CONNECTING");

  const setRealtimeStatus = useCallback((status: RealtimeStatus) => {
    setRealtimeStatusState(status);
  }, []);

  const value = useMemo(
    () => ({ realtimeStatus, setRealtimeStatus }),
    [realtimeStatus, setRealtimeStatus],
  );

  return (
    <RealtimeStatusContext.Provider value={value}>
      {children}
    </RealtimeStatusContext.Provider>
  );
}

/** Read the current connection status (used by ConnectionStatus component in layout). */
export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeStatusContext).realtimeStatus;
}

/** Push status updates into the context (used by useRealtimeAppointments hook). */
export function useRealtimeStatusSetter(): (status: RealtimeStatus) => void {
  return useContext(RealtimeStatusContext).setRealtimeStatus;
}
