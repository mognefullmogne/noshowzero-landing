"use client";

import { useState, useEffect, useCallback } from "react";
import { OffersTable } from "@/components/offers/offers-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Gift, CheckCircle, XCircle, Clock } from "lucide-react";
import type { WaitlistOffer } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

interface OfferStats {
  readonly total: number;
  readonly pending: number;
  readonly accepted: number;
  readonly declined: number;
  readonly expired: number;
}

export default function OffersPage() {
  const [offers, setOffers] = useState<readonly WaitlistOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [overallStats, setOverallStats] = useState<OfferStats | null>(null);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/offers?${params}`);
      const data = await res.json();
      if (data.success) {
        setOffers(data.data);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics");
      const json = await res.json();
      if (json.success) {
        setOverallStats({
          total: json.data.offersSent ?? 0,
          pending: json.data.offersPending ?? 0,
          accepted: json.data.offersAccepted ?? 0,
          declined: json.data.offersDeclined ?? 0,
          expired: json.data.offersExpired ?? 0,
        });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backfill Offers</h1>
          <p className="text-sm text-gray-500">
            {total} offer{total !== 1 ? "s" : ""} total — Automatic waitlist backfill engine
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {overallStats && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-black/[0.04] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-blue-500" />
              <p className="text-xs font-medium text-gray-500">Total Sent</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900">{overallStats.total}</p>
          </div>
          <div className="rounded-2xl border border-black/[0.04] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-xs font-medium text-gray-500">Accepted</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-green-700">{overallStats.accepted}</p>
            {overallStats.total > 0 && (
              <p className="text-xs text-gray-400">
                {Math.round((overallStats.accepted / overallStats.total) * 100)}% fill rate
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-black/[0.04] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <p className="text-xs font-medium text-gray-500">Pending</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-amber-700">{overallStats.pending}</p>
          </div>
          <div className="rounded-2xl border border-black/[0.04] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-400" />
              <p className="text-xs font-medium text-gray-500">Declined / Expired</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-600">
              {overallStats.declined + overallStats.expired}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {statusFilter !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStatusFilter("all"); setPage(1); }}
            className="text-xs text-gray-500"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="mt-4">
        <OffersTable offers={offers} loading={loading} />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
