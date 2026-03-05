// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState, useMemo } from "react";
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
import type { AppointmentStatus } from "@/lib/types";
import { useTenant } from "@/hooks/use-tenant";
import { useRealtimeAppointments } from "@/hooks/use-realtime-appointments";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "reminder_sent", label: "Reminder Sent" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No Show" },
  { value: "cancelled", label: "Cancelled" },
];

const PAGE_SIZE = 20;

export default function AppointmentsPage() {
  const { tenant } = useTenant();
  const { appointments: realtimeAppointments, loading: realtimeLoading } =
    useRealtimeAppointments(tenant?.id);

  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [page, setPage] = useState(1);

  // Client-side filtering against Realtime state
  const filteredAppointments = useMemo(() => {
    let result = realtimeAppointments;
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === (statusFilter as AppointmentStatus));
    }
    if (dateFrom) {
      const fromDate = new Date(dateFrom + "T00:00:00");
      result = result.filter((a) => new Date(a.scheduled_at) >= fromDate);
    }
    return result;
  }, [realtimeAppointments, statusFilter, dateFrom]);

  // Client-side pagination
  const totalFiltered = filteredAppointments.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const paginatedAppointments = filteredAppointments.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500">
            {totalFiltered} appointment{totalFiltered !== 1 ? "s" : ""} total
          </p>
        </div>
        <AppointmentDialog onCreated={() => {}} />
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
          appointments={paginatedAppointments}
          loading={realtimeLoading}
          onRefresh={() => {}}
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
