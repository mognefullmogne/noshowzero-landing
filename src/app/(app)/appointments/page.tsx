"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AppointmentsTable } from "@/components/appointments/appointments-table";
import { AppointmentDialog } from "@/components/appointments/appointment-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Appointment, AppointmentStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "reminder_sent", label: "Reminder Sent" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No Show" },
  { value: "cancelled", label: "Cancelled" },
];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<readonly Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Track whether this is the first load (show spinner) vs background poll (silent)
  const isFirstLoad = useRef(true);

  const fetchAppointments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());

      const res = await fetch(`/api/appointments?${params}`);
      const data = await res.json();
      if (data.success) {
        setAppointments(data.data);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch { /* ignore */ }
    if (!silent) setLoading(false);
    isFirstLoad.current = false;
  }, [page, statusFilter, dateFrom]);

  // Initial load + refetch on filter/page change
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Auto-poll every 30 seconds (silent — no loading spinner)
  // Pauses when tab is not visible to save resources
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAppointments(true);
      }
    }, 30_000);
    return () => clearInterval(poll);
  }, [fetchAppointments]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500">
            {total} appointment{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <AppointmentDialog onCreated={fetchAppointments} />
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
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="w-40"
          placeholder="From date"
        />
        {(statusFilter !== "all" || dateFrom) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStatusFilter("all"); setDateFrom(""); setPage(1); }}
            className="text-xs text-gray-500"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="mt-4">
        <AppointmentsTable
          appointments={appointments}
          loading={loading}
          onRefresh={fetchAppointments}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
