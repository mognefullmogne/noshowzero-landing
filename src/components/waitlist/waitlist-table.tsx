"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UrgencyBadge } from "./urgency-badge";
import { ScoreBreakdown } from "./score-breakdown";
import { Users, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WaitlistEntry, WaitlistStatus, SmartScoreBreakdown } from "@/lib/types";

const STATUS_STYLES: Record<WaitlistStatus, string> = {
  waiting: "bg-blue-50 text-blue-700",
  offer_pending: "bg-amber-50 text-amber-700",
  offer_accepted: "bg-green-50 text-green-700",
  offer_declined: "bg-orange-50 text-orange-700",
  offer_timeout: "bg-gray-100 text-gray-600",
  fulfilled: "bg-emerald-50 text-emerald-700",
  expired: "bg-gray-100 text-gray-500",
  withdrawn: "bg-red-50 text-red-600",
};

interface WaitlistTableProps {
  readonly entries: readonly WaitlistEntry[];
  readonly loading: boolean;
  readonly onRefresh: () => void;
}

export function WaitlistTable({ entries, loading, onRefresh }: WaitlistTableProps) {
  const [selected, setSelected] = useState<WaitlistEntry | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  async function handleWithdraw(id: string) {
    setWithdrawing(id);
    try {
      await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
      onRefresh();
    } catch { /* ignore */ }
    setWithdrawing(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
        <Users className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm font-medium text-gray-600">No waitlist entries</p>
        <p className="text-xs text-gray-400 mt-1">Add patients to the waitlist to fill cancellations.</p>
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
              <TableHead className="font-semibold">Urgency</TableHead>
              <TableHead className="font-semibold">Score</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                className="cursor-pointer hover:bg-blue-50/30 transition-colors"
                onClick={() => setSelected(entry)}
              >
                <TableCell>
                  <p className="text-sm font-medium text-gray-900">
                    {entry.patient ? `${entry.patient.first_name} ${entry.patient.last_name}` : "—"}
                  </p>
                  <p className="text-xs text-gray-400">
                    Added {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-gray-900">{entry.service_name}</p>
                  {entry.preferred_provider && (
                    <p className="text-xs text-gray-400">Pref: {entry.preferred_provider}</p>
                  )}
                </TableCell>
                <TableCell>
                  <UrgencyBadge urgency={entry.clinical_urgency} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">{entry.smart_score ?? entry.priority_score}</span>
                    <span className="text-xs text-gray-400">/100</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("text-xs font-medium rounded-full capitalize", STATUS_STYLES[entry.status])}>
                    {entry.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {entry.status === "waiting" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); handleWithdraw(entry.id); }}
                      disabled={withdrawing === entry.id}
                    >
                      {withdrawing === entry.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail dialog with score breakdown */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {selected.patient ? `${selected.patient.first_name} ${selected.patient.last_name}` : "Waitlist Entry"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Service</p>
                  <p className="font-medium">{selected.service_name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Urgency</p>
                  <UrgencyBadge urgency={selected.clinical_urgency} />
                </div>
                <div>
                  <p className="text-gray-500">Flexible</p>
                  <p className="font-medium">{selected.flexible_time ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Offers</p>
                  <p className="font-medium">{selected.offers_sent}/{selected.max_offers}</p>
                </div>
                {selected.distance_km != null && (
                  <div>
                    <p className="text-gray-500">Distance</p>
                    <p className="font-medium">{selected.distance_km} km</p>
                  </div>
                )}
              </div>
              {selected.smart_score_breakdown && (
                <ScoreBreakdown breakdown={selected.smart_score_breakdown as SmartScoreBreakdown} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
