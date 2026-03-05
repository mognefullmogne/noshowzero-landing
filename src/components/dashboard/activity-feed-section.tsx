// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { Activity, CheckCircle, Clock, Send, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---

export interface ActivityEvent {
  readonly id: string;
  readonly status: string;
  readonly offered_at: string;
  readonly responded_at: string | null;
  readonly patient?: { first_name: string; last_name: string } | null;
  readonly original_appointment?: {
    service_name: string;
    scheduled_at: string;
  } | null;
}

// --- Event type mapping ---

interface EventTypeConfig {
  readonly label: string;
  readonly dotColor: string;
  readonly icon: typeof CheckCircle;
  readonly iconColor: string;
}

const EVENT_TYPE_MAP: Record<string, EventTypeConfig> = {
  pending: {
    label: "Offerta inviata",
    dotColor: "bg-amber-400",
    icon: Send,
    iconColor: "text-amber-500",
  },
  accepted: {
    label: "Offerta accettata",
    dotColor: "bg-green-400",
    icon: CheckCircle,
    iconColor: "text-green-500",
  },
  declined: {
    label: "Offerta rifiutata",
    dotColor: "bg-gray-300",
    icon: XCircle,
    iconColor: "text-gray-400",
  },
  expired: {
    label: "Offerta scaduta",
    dotColor: "bg-red-400",
    icon: Clock,
    iconColor: "text-red-500",
  },
};

const DEFAULT_EVENT_CONFIG: EventTypeConfig = {
  label: "Evento",
  dotColor: "bg-gray-300",
  icon: Activity,
  iconColor: "text-gray-400",
};

// --- Helpers ---

function formatPatientName(
  patient: { first_name: string; last_name: string } | null | undefined
): string {
  if (!patient) return "\u2014";
  return `${patient.last_name} ${patient.first_name}`;
}

function formatEventTimestamp(
  offeredAt: string,
  respondedAt: string | null
): string {
  const raw = respondedAt ?? offeredAt;
  const date = new Date(raw);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const time = date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return time;

  const day = date.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
  return `${day} ${time}`;
}

function formatSlotTime(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Component ---

interface ActivityFeedSectionProps {
  readonly events: readonly ActivityEvent[];
}

export function ActivityFeedSection({ events }: ActivityFeedSectionProps) {
  return (
    <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
          <Activity className="h-3.5 w-3.5 text-indigo-600" />
        </div>
        <h2 className="text-sm font-semibold text-gray-700">
          Attivita&apos; Recupero
        </h2>
      </div>

      {/* Empty state */}
      {events.length === 0 ? (
        <div className="text-center py-6">
          <Activity className="mx-auto h-8 w-8 text-gray-200" />
          <p className="mt-2 text-sm text-gray-400">
            Nessuna attivita&apos; recente
          </p>
        </div>
      ) : (
        /* Scrollable event list */
        <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
          {events.map((event) => {
            const config = EVENT_TYPE_MAP[event.status] ?? DEFAULT_EVENT_CONFIG;
            const EventIcon = config.icon;

            return (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-gray-50 transition-colors"
              >
                {/* Status dot */}
                <div
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    config.dotColor
                  )}
                />

                {/* Icon */}
                <EventIcon
                  className={cn("h-3.5 w-3.5 shrink-0", config.iconColor)}
                />

                {/* Event label + patient */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    <span className="font-medium">{config.label}</span>
                    <span className="text-gray-400 mx-1">&middot;</span>
                    <span>{formatPatientName(event.patient)}</span>
                  </p>
                  {event.original_appointment && (
                    <p className="text-[11px] text-gray-400 truncate">
                      {event.original_appointment.service_name}{" "}
                      {formatSlotTime(
                        event.original_appointment.scheduled_at
                      )}
                    </p>
                  )}
                </div>

                {/* Timestamp */}
                <span className="text-[11px] text-gray-400 shrink-0">
                  {formatEventTimestamp(event.offered_at, event.responded_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
