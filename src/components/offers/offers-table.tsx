// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState } from "react";
import { formatDate, formatTime, formatDateTime } from "@/lib/utils/datetime";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OfferStatusBadge } from "./offer-status-badge";
import { ScoreBreakdown } from "@/components/waitlist/score-breakdown";
import { Gift, Loader2, Clock, CalendarDays, User, ArrowRight } from "lucide-react";
import type { WaitlistOffer, SmartScoreBreakdown } from "@/lib/types";

interface OffersTableProps {
  readonly offers: readonly WaitlistOffer[];
  readonly loading: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMin = Math.round((now - date) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.round(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.round(diffHrs / 24);
  return `${diffDays}d ago`;
}

function formatResponseTime(offeredAt: string, respondedAt: string | null): string {
  if (!respondedAt) return "—";
  const offered = new Date(offeredAt).getTime();
  const responded = new Date(respondedAt).getTime();
  const diffMin = Math.round((responded - offered) / 60000);
  if (diffMin < 1) return "<1 min";
  if (diffMin < 60) return `${diffMin} min`;
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export function OffersTable({ offers, loading }: OffersTableProps) {
  const [selected, setSelected] = useState<WaitlistOffer | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
        <Gift className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm font-medium text-gray-600">No offers yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Offers are created automatically when appointments are cancelled or no-showed.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-black/[0.04] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="font-semibold">Patient</TableHead>
              <TableHead className="font-semibold">Service</TableHead>
              <TableHead className="font-semibold">Score</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Offered</TableHead>
              <TableHead className="font-semibold">Response Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offers.map((offer) => {
              const patient = offer.patient;
              const appt = offer.original_appointment;
              return (
                <TableRow
                  key={offer.id}
                  className="cursor-pointer hover:bg-blue-50/30 transition-colors"
                  onClick={() => setSelected(offer)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                        <User className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {patient ? `${patient.first_name} ${patient.last_name}` : "—"}
                        </p>
                        {patient?.preferred_channel && (
                          <p className="text-xs text-gray-400 capitalize">{patient.preferred_channel}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-gray-900">{appt?.service_name ?? "—"}</p>
                    {appt?.scheduled_at && (
                      <p className="text-xs text-gray-400">
                        {formatDate(appt.scheduled_at)}{" "}
                        {formatTime(appt.scheduled_at)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-900">{offer.smart_score ?? "—"}</span>
                      <span className="text-xs text-gray-400">/100</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <OfferStatusBadge status={offer.status} />
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-gray-700">{formatRelativeTime(offer.offered_at)}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(offer.offered_at)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-gray-700">
                      {formatResponseTime(offer.offered_at, offer.responded_at)}
                    </p>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Detail dialog */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Offer Details
                <OfferStatusBadge status={selected.status} />
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Patient */}
              {selected.patient && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Patient</p>
                  <p className="text-sm text-gray-900">
                    {selected.patient.first_name} {selected.patient.last_name}
                  </p>
                  {selected.patient.phone && (
                    <p className="text-xs text-gray-400">{selected.patient.phone}</p>
                  )}
                  {selected.patient.email && (
                    <p className="text-xs text-gray-400">{selected.patient.email}</p>
                  )}
                </div>
              )}

              {/* Original appointment */}
              {selected.original_appointment && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Original Slot</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CalendarDays className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">
                      {selected.original_appointment.service_name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 ml-6">
                    {formatDateTime(selected.original_appointment.scheduled_at)}
                    {" · "}{selected.original_appointment.duration_min}min
                  </p>
                  {selected.original_appointment.provider_name && (
                    <p className="text-xs text-gray-400 ml-6">
                      Provider: {selected.original_appointment.provider_name}
                    </p>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">Offered At</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-sm text-gray-900">
                      {formatDateTime(selected.offered_at)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Expires At</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-sm text-gray-900">
                      {formatDateTime(selected.expires_at)}
                    </p>
                  </div>
                </div>
              </div>

              {selected.responded_at && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Response</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm text-gray-900">
                      Responded in {formatResponseTime(selected.offered_at, selected.responded_at)}
                    </span>
                  </div>
                </div>
              )}

              {/* Smart score breakdown */}
              {selected.smart_score_breakdown && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Smart Score Breakdown</p>
                  <ScoreBreakdown breakdown={selected.smart_score_breakdown as SmartScoreBreakdown} />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
