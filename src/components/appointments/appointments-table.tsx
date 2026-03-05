// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

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
import { RiskBadge } from "./risk-badge";
import { StatusBadge } from "./status-badge";
import { AppointmentDetail } from "./appointment-detail";
import type { Appointment, Reminder } from "@/lib/types";
import { CalendarDays, User, Loader2, Zap, X } from "lucide-react";

interface AppointmentsTableProps {
  readonly appointments: readonly Appointment[];
  readonly loading: boolean;
  readonly onRefresh: () => void;
}

export function AppointmentsTable({ appointments, loading, onRefresh }: AppointmentsTableProps) {
  const [selected, setSelected] = useState<(Appointment & { reminders?: Reminder[] }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function cancelAppointment(e: React.MouseEvent, apptId: string) {
    e.stopPropagation();
    if (!window.confirm("Sei sicuro? L'appuntamento verrà cancellato e lo slot sarà disponibile per il backfill AI.")) return;
    setCancellingId(apptId);
    try {
      const res = await fetch(`/api/appointments/${apptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch { /* ignore */ }
    setCancellingId(null);
  }

  async function openDetail(appt: Appointment) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appt.id}`);
      const data = await res.json();
      if (data.success) {
        setSelected(data.data);
      }
    } catch { /* ignore */ }
    setDetailLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
        <CalendarDays className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm font-medium text-gray-600">No appointments yet</p>
        <p className="text-xs text-gray-400 mt-1">Create your first appointment to get started.</p>
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
              <TableHead className="font-semibold">Scheduled</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Backfill</TableHead>
              <TableHead className="font-semibold">Risk</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((appt) => (
              <TableRow
                key={appt.id}
                className="cursor-pointer hover:bg-blue-50/30 transition-colors"
                onClick={() => openDetail(appt)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {appt.patient ? `${appt.patient.first_name} ${appt.patient.last_name}` : "—"}
                      </p>
                      {appt.patient?.email && (
                        <p className="text-xs text-gray-400">{appt.patient.email}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-gray-900">{appt.service_name}</p>
                  {appt.provider_name && (
                    <p className="text-xs text-gray-400">{appt.provider_name}</p>
                  )}
                </TableCell>
                <TableCell>
                  <p className="text-sm text-gray-900">
                    {new Date(appt.scheduled_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(appt.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" · "}{appt.duration_min}min
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge status={appt.status} />
                </TableCell>
                <TableCell>
                  {(appt.status === "cancelled" || appt.status === "no_show") ? (
                    <div className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-purple-500" />
                      <span className="text-xs text-purple-600 font-medium">Active</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <RiskBadge score={appt.risk_score} />
                </TableCell>
                <TableCell>
                  <button
                    onClick={(e) => cancelAppointment(e, appt.id)}
                    disabled={cancellingId === appt.id}
                    title="Cancella appuntamento"
                    className="rounded-md p-1.5 text-red-400 border border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    {cancellingId === appt.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <AppointmentDetail
          appointment={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
          onUpdated={() => {
            setSelected(null);
            onRefresh();
          }}
        />
      )}

      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}
    </>
  );
}
