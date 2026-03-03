"use client";

import { cn } from "@/lib/utils";
import { useRealtimeStatus } from "@/contexts/realtime-status-context";

const STATUS_CONFIG = {
  SUBSCRIBED: {
    label: "Live",
    className: "text-green-700 bg-green-50 border-green-200",
    dotClassName: "bg-green-500 animate-pulse",
  },
  CONNECTING: {
    label: "Connessione",
    className: "text-amber-700 bg-amber-50 border-amber-200",
    dotClassName: "bg-amber-500 animate-pulse",
  },
  TIMED_OUT: {
    label: "Offline",
    className: "text-red-700 bg-red-50 border-red-200",
    dotClassName: "bg-red-500",
  },
  CLOSED: {
    label: "Offline",
    className: "text-red-700 bg-red-50 border-red-200",
    dotClassName: "bg-red-500",
  },
  CHANNEL_ERROR: {
    label: "Offline",
    className: "text-red-700 bg-red-50 border-red-200",
    dotClassName: "bg-red-500",
  },
} as const;

export function ConnectionStatus() {
  const { status: realtimeStatus, active } = useRealtimeStatus();

  if (!active) {
    return null;
  }

  const config = STATUS_CONFIG[realtimeStatus];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium rounded-full border px-2.5 py-0.5 whitespace-nowrap shrink-0",
        config.className,
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotClassName)}
      />
      {config.label}
    </span>
  );
}
