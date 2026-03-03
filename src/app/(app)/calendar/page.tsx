"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Plus,
  Lock,
  Unlock,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import type { AppointmentSlot, Appointment } from "@/lib/types";
import { AppointmentDetail } from "@/components/appointments/appointment-detail";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00–18:00
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

interface CalendarAppointment {
  readonly id: string;
  readonly service_name: string;
  readonly provider_name: string | null;
  readonly scheduled_at: string;
  readonly duration_min: number;
  readonly status: string;
  readonly patient_name: string;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-indigo-50 text-indigo-700 border-indigo-200",
  reminder_pending: "bg-indigo-50 text-indigo-700 border-indigo-200",
  reminder_sent: "bg-yellow-50 text-yellow-700 border-yellow-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-gray-50 text-gray-500 border-gray-200",
  no_show: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-gray-50 text-gray-400 border-gray-200",
  declined: "bg-orange-50 text-orange-700 border-orange-200",
  timeout: "bg-orange-50 text-orange-600 border-orange-200",
};

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [loadingAppointment, setLoadingAppointment] = useState(false);
  const isFetchingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const from = weekStart.toISOString();
      const toDate = new Date(weekStart);
      toDate.setDate(toDate.getDate() + 4);
      toDate.setHours(23, 59, 59, 999);
      const to = toDate.toISOString();

      const [slotsRes, apptsRes] = await Promise.all([
        fetch(`/api/slots?from=${from}&to=${to}&pageSize=200`),
        fetch(`/api/appointments?from=${from}&to=${to}&pageSize=200`),
      ]);

      if (slotsRes.ok) {
        const slotsJson = await slotsRes.json();
        if (slotsJson.success) setSlots(slotsJson.data);
      }

      if (apptsRes.ok) {
        const apptsJson = await apptsRes.json();
        if (apptsJson.success) {
          const mapped: CalendarAppointment[] = (apptsJson.data as Appointment[]).map((a) => {
            const patient = a.patient as unknown as Record<string, string> | undefined;
            return {
              id: a.id,
              service_name: a.service_name,
              provider_name: a.provider_name,
              scheduled_at: a.scheduled_at,
              duration_min: a.duration_min,
              status: a.status,
              patient_name: patient
                ? `${patient.first_name} ${patient.last_name}`
                : "Unknown",
            };
          });
          setAppointments(mapped);
        }
      }

      setError(null);
    } catch (err) {
      console.error("Calendar fetch error:", err);
      setError("Failed to load calendar data");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleGenerateSlots = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const startDate = weekStart.toISOString().split("T")[0];
      const endDate = new Date(weekStart.getTime() + 4 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const res = await fetch("/api/slots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_name: "Dr. Default",
          start_date: startDate,
          end_date: endDate,
          slot_duration_min: 30,
          day_start_hour: 8,
          day_end_hour: 18,
          exclude_weekends: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Failed to generate slots");
      }
    } catch {
      setError("Failed to generate slots — network error");
    }
    setGenerating(false);
    fetchData();
  }, [weekStart, fetchData]);

  const toggleSlotBlock = useCallback(
    async (slot: AppointmentSlot) => {
      const newStatus = slot.status === "blocked" ? "available" : "blocked";
      try {
        const res = await fetch(`/api/slots/${slot.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          setError("Failed to update slot");
        }
      } catch {
        setError("Failed to update slot — network error");
      }
      fetchData();
    },
    [fetchData]
  );

  const openAppointmentDetail = useCallback(async (appointmentId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingAppointment(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message ?? "Failed to load appointment details");
        return;
      }
      const json = await res.json();
      if (json.success) {
        setSelectedAppointment(json.data);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Failed to load appointment details");
    } finally {
      setLoadingAppointment(false);
    }
  }, []);

  const prevWeek = () =>
    setWeekStart(new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000));
  const nextWeek = () =>
    setWeekStart(new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000));

  // Group slots by day/hour
  const slotGrid: Record<string, AppointmentSlot[]> = {};
  for (const slot of slots) {
    const d = new Date(slot.start_at);
    const dayIdx = (d.getDay() + 6) % 7; // Monday=0
    const hour = d.getHours();
    const key = `${dayIdx}-${hour}`;
    if (!slotGrid[key]) slotGrid[key] = [];
    slotGrid[key].push(slot);
  }

  // Group appointments by day/hour
  const apptGrid: Record<string, CalendarAppointment[]> = {};
  for (const appt of appointments) {
    if (appt.status === "cancelled") continue;
    const d = new Date(appt.scheduled_at);
    const dayIdx = (d.getDay() + 6) % 7;
    const hour = d.getHours();
    const key = `${dayIdx}-${hour}`;
    if (!apptGrid[key]) apptGrid[key] = [];
    apptGrid[key].push(appt);
  }

  const weekDates = DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const hasContent = slots.length > 0 || appointments.length > 0;

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Manage provider schedules and view appointments"
        actions={
          <Button onClick={handleGenerateSlots} disabled={generating}>
            <Plus className="mr-2 h-4 w-4" />
            {generating ? "Generating..." : "Generate Slots"}
          </Button>
        }
      />

      {/* Week navigation */}
      <div className="mb-4 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={prevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-gray-700">
          {weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} –{" "}
          {weekDates[4].toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <Button variant="outline" size="sm" onClick={nextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-100 border border-green-300" />
          Available slot
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-gray-200 border border-gray-300" />
          Blocked
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-indigo-100 border border-indigo-300" />
          Scheduled
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-emerald-100 border border-emerald-300" />
          Confirmed
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-100 border border-red-300" />
          No-show
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : !hasContent ? (
        <EmptyState
          icon={<CalendarRange className="h-10 w-10" />}
          title="No slots or appointments for this week"
          description="Generate slots to start managing your calendar, or create an appointment"
          action={
            <Button onClick={handleGenerateSlots} disabled={generating}>
              Generate Weekly Slots
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-16 border-b border-r border-gray-200 bg-gray-50 p-2 text-xs font-medium text-gray-500">
                  Time
                </th>
                {weekDates.map((d, i) => {
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <th
                      key={i}
                      className={`border-b border-gray-200 p-2 text-center ${
                        isToday ? "bg-blue-50" : "bg-gray-50"
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-500">{DAYS[i]}</div>
                      <div
                        className={`text-sm font-semibold ${
                          isToday ? "text-blue-600" : "text-gray-900"
                        }`}
                      >
                        {d.getDate()}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour}>
                  <td className="border-r border-b border-gray-100 p-2 text-center text-xs text-gray-400">
                    {String(hour).padStart(2, "0")}:00
                  </td>
                  {DAYS.map((_, dayIdx) => {
                    const cellSlots = slotGrid[`${dayIdx}-${hour}`] ?? [];
                    const cellAppts = apptGrid[`${dayIdx}-${hour}`] ?? [];
                    const isToday =
                      weekDates[dayIdx].toDateString() === new Date().toDateString();
                    return (
                      <td
                        key={dayIdx}
                        className={`border-b border-gray-100 p-1 ${
                          isToday ? "bg-blue-50/30" : ""
                        }`}
                      >
                        <div className="space-y-1">
                          {/* Appointments first — clickable */}
                          {cellAppts.map((appt) => (
                            <button
                              key={appt.id}
                              onClick={() => openAppointmentDetail(appt.id)}
                              disabled={loadingAppointment}
                              className={`flex w-full items-center gap-1 rounded-lg border px-2 py-1.5 text-xs text-left cursor-pointer transition hover:ring-2 hover:ring-blue-300 hover:ring-offset-1 ${
                                STATUS_COLORS[appt.status] ??
                                "bg-gray-50 text-gray-600 border-gray-200"
                              }`}
                            >
                              <User className="h-3 w-3 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                  {appt.patient_name}
                                </div>
                                <div className="truncate opacity-75">
                                  {appt.service_name}
                                  {appt.provider_name ? ` · ${appt.provider_name}` : ""}
                                </div>
                              </div>
                            </button>
                          ))}
                          {/* Available/blocked slots */}
                          {cellSlots.map((slot) => (
                            <button
                              key={slot.id}
                              onClick={() => toggleSlotBlock(slot)}
                              className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs transition ${
                                slot.status === "available"
                                  ? "bg-green-50 text-green-700 hover:bg-green-100"
                                  : slot.status === "booked"
                                  ? "bg-blue-50 text-blue-700"
                                  : slot.status === "blocked"
                                  ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                  : "bg-gray-50 text-gray-400"
                              }`}
                            >
                              <span className="truncate">{slot.provider_name}</span>
                              {slot.status === "blocked" ? (
                                <Lock className="h-3 w-3 flex-shrink-0" />
                              ) : slot.status === "available" ? (
                                <Unlock className="h-3 w-3 flex-shrink-0 opacity-30" />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Appointment detail dialog */}
      {selectedAppointment && (
        <AppointmentDetail
          appointment={selectedAppointment}
          open={true}
          onClose={() => setSelectedAppointment(null)}
          onUpdated={() => {
            openAppointmentDetail(selectedAppointment.id);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
