"use client";

import { useState, useEffect, useCallback } from "react";
import { WaitlistTable } from "@/components/waitlist/waitlist-table";
import { WaitlistDialog } from "@/components/waitlist/waitlist-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { WaitlistEntry } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "waiting", label: "Waiting" },
  { value: "offer_pending", label: "Offer Pending" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "withdrawn", label: "Withdrawn" },
];

export default function WaitlistPage() {
  const [entries, setEntries] = useState<readonly WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/waitlist?${params}`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.data);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
          <p className="text-sm text-gray-500">
            {total} entr{total !== 1 ? "ies" : "y"} total
          </p>
        </div>
        <WaitlistDialog onCreated={fetchEntries} />
      </div>

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
        <WaitlistTable entries={entries} loading={loading} onRefresh={fetchEntries} />
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
