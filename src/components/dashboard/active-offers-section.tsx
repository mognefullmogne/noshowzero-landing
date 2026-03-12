// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState, useEffect } from "react";
import { Zap, TimerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateObj } from "@/lib/utils/datetime";

// --- Types ---

export interface ActiveOffer {
  readonly id: string;
  readonly status: string;
  readonly offered_at: string;
  readonly expires_at: string;
  readonly patient?: { first_name: string; last_name: string } | null;
  readonly original_appointment?: {
    service_name: string;
    scheduled_at: string;
  } | null;
}

// --- Helpers ---

function computeMinutesLeft(expiresAt: string): number {
  return Math.max(
    0,
    Math.round((new Date(expiresAt).getTime() - Date.now()) / 60_000)
  );
}

function formatSlotTime(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  return formatDateObj(date, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPatientName(
  patient: { first_name: string; last_name: string } | null | undefined
): string {
  if (!patient) return "\u2014";
  return `${patient.last_name} ${patient.first_name}`;
}

// --- Component ---

interface ActiveOffersSectionProps {
  readonly offers: readonly ActiveOffer[];
}

export function ActiveOffersSection({ offers }: ActiveOffersSectionProps) {
  // Tick counter forces re-render every 60s for countdown updates
  const [, setTick] = useState(0);

  useEffect(() => {
    if (offers.length === 0) return;
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 60_000);
    return () => clearInterval(interval);
  }, [offers.length]);

  return (
    <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
          <Zap className="h-3.5 w-3.5 text-amber-600" />
        </div>
        <h2 className="text-sm font-semibold text-gray-700">Offerte Attive</h2>
        {offers.length > 0 && (
          <Badge className="ml-auto text-[10px] font-medium rounded-full bg-amber-50 text-amber-700">
            {offers.length}
          </Badge>
        )}
      </div>

      {/* Empty state */}
      {offers.length === 0 ? (
        <div className="text-center py-6">
          <TimerOff className="mx-auto h-8 w-8 text-gray-200" />
          <p className="mt-2 text-sm text-gray-400">
            Nessuna offerta attiva
          </p>
        </div>
      ) : (
        /* Offer rows */
        <div className="space-y-2">
          {/* Column labels */}
          <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 px-1">
            <span className="flex-1">Paziente</span>
            <span className="w-36 text-center shrink-0">Slot</span>
            <span className="w-20 text-right shrink-0">Scadenza</span>
          </div>

          {offers.map((offer) => {
            const minutesLeft = computeMinutesLeft(offer.expires_at);
            const isExpired = minutesLeft === 0;
            const isUrgent = minutesLeft > 0 && minutesLeft <= 15;

            return (
              <div
                key={offer.id}
                className="flex items-center gap-3 rounded-xl border border-black/[0.04] px-3 py-2.5"
              >
                {/* Patient name */}
                <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                  {formatPatientName(offer.patient)}
                </span>

                {/* Slot time */}
                <span className="w-36 text-center text-xs text-gray-500 shrink-0 truncate">
                  {offer.original_appointment
                    ? formatSlotTime(offer.original_appointment.scheduled_at)
                    : "\u2014"}
                </span>

                {/* Countdown badge */}
                <Badge
                  className={cn(
                    "w-20 justify-center text-[11px] font-semibold rounded-full shrink-0",
                    isExpired && "bg-gray-100 text-gray-500",
                    isUrgent && "bg-red-50 text-red-700",
                    !isExpired && !isUrgent && "bg-amber-50 text-amber-700"
                  )}
                >
                  {isExpired ? "Scaduta" : `${minutesLeft} min`}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
