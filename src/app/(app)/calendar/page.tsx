"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Plus,
  Lock,
  Loader2,
  Unlock,
  User,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import type { AppointmentSlot, Appointment } from "@/lib/types";
import { AppointmentDetail } from "@/components/appointments/appointment-detail";
import { useTenant } from "@/hooks/use-tenant";
import { useRealtimeAppointments } from "@/hooks/use-realtime-appointments";

// --- Calendar layout constants ---
const DAY_START = 7; // 7:00 AM
const DAY_END = 19; // 7:00 PM
const TOTAL_HOURS = DAY_END - DAY_START; // 12 hours
const HOUR_HEIGHT = 72; // px per hour
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT; // 864px
const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i + DAY_START);
const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven"];

interface CalendarAppointment {
  readonly id: string;
  readonly service_name: string;
  readonly provider_name: string | null;
  readonly scheduled_at: string;
  readonly duration_min: number;
  readonly status: string;
  readonly patient_name: string;
}

/** Appointment with computed layout position */
interface LayoutAppt extends CalendarAppointment {
  readonly top: number;
  readonly height: number;
  readonly colIndex: number;
  readonly totalCols: number;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMinutesFromMidnight(dateStr: string): number {
  const d = new Date(dateStr);
  return d.getHours() * 60 + d.getMinutes();
}

/** Position appointments in columns to handle overlaps (Google Calendar-style). */
function layoutAppointments(appts: readonly CalendarAppointment[]): LayoutAppt[] {
  if (appts.length === 0) return [];

  const sorted = [...appts].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  // Column-packing: assign each appointment to the first column with no overlap
  const colEnds: number[] = []; // end-minute of last appt in each column
  const colMap = new Map<string, number>();

  for (const appt of sorted) {
    const startMin = getMinutesFromMidnight(appt.scheduled_at);
    const endMin = startMin + appt.duration_min;

    let placed = false;
    for (let c = 0; c < colEnds.length; c++) {
      if (startMin >= colEnds[c]) {
        colEnds[c] = endMin;
        colMap.set(appt.id, c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      colMap.set(appt.id, colEnds.length);
      colEnds.push(endMin);
    }
  }

  // For each appointment, compute totalCols among its overlapping cluster
  return sorted.map((appt) => {
    const startMin = getMinutesFromMidnight(appt.scheduled_at);
    const endMin = startMin + appt.duration_min;
    const col = colMap.get(appt.id) ?? 0;

    // Find all appointments that overlap with this one (directly or transitively)
    const overlapping = sorted.filter((other) => {
      const otherStart = getMinutesFromMidnight(other.scheduled_at);
      const otherEnd = otherStart + other.duration_min;
      return startMin < otherEnd && endMin > otherStart;
    });

    const maxCol = Math.max(...overlapping.map((o) => colMap.get(o.id) ?? 0));
    const totalCols = maxCol + 1;

    const top = ((startMin - DAY_START * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max((appt.duration_min / 60) * HOUR_HEIGHT, 24);

    return { ...appt, top, height, colIndex: col, totalCols };
  });
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-indigo-100/90 text-indigo-800 border-indigo-300",
  reminder_pending: "bg-indigo-100/90 text-indigo-800 border-indigo-300",
  reminder_sent: "bg-yellow-100/90 text-yellow-800 border-yellow-300",
  confirmed: "bg-emerald-100/90 text-emerald-800 border-emerald-300",
  completed: "bg-gray-100/90 text-gray-500 border-gray-300",
  no_show: "bg-red-100/90 text-red-800 border-red-300",
  cancelled: "bg-purple-50/90 text-purple-600 border-purple-300",
  declined: "bg-orange-100/90 text-orange-800 border-orange-300",
  timeout: "bg-orange-100/90 text-orange-700 border-orange-300",
};

export default function CalendarPage() {
  const { tenant } = useTenant();
  const { appointments: realtimeAppointments } = useRealtimeAppointments(tenant?.id);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [loadingAppointment, setLoadingAppointment] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
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
                : "Sconosciuto",
            };
          });
          setAppointments(mapped);
        }
      }

      setError(null);
    } catch (err) {
      console.error("Calendar fetch error:", err);
      setError("Errore nel caricamento del calendario");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchData();
  }, [realtimeAppointments, fetchData]);

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
        setError(data?.error?.message ?? "Errore nella generazione slot");
      }
    } catch {
      setError("Errore di rete nella generazione slot");
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
          setError("Errore nell'aggiornamento slot");
        }
      } catch {
        setError("Errore di rete nell'aggiornamento slot");
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
        setError(data?.error?.message ?? "Errore nel caricamento dettagli");
        return;
      }
      const json = await res.json();
      if (json.success) {
        setSelectedAppointment(json.data);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Errore nel caricamento dettagli appuntamento");
    } finally {
      setLoadingAppointment(false);
    }
  }, []);

  const cancelAppointment = useCallback(
    async (e: React.MouseEvent, apptId: string) => {
      e.stopPropagation();
      if (
        !window.confirm(
          "Sei sicuro? L'appuntamento verrà cancellato e lo slot sarà disponibile per il backfill AI."
        )
      )
        return;
      setCancellingId(apptId);
      try {
        const res = await fetch(`/api/appointments/${apptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        });
        if (res.ok) {
          fetchData();
        }
      } catch {
        /* ignore */
      }
      setCancellingId(null);
    },
    [fetchData]
  );

  const prevWeek = () =>
    setWeekStart(new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000));
  const nextWeek = () =>
    setWeekStart(new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000));

  const weekDates = DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Group slots by day index
  const slotsByDay = useMemo(() => {
    const map: Record<number, AppointmentSlot[]> = {};
    for (const slot of slots) {
      const d = new Date(slot.start_at);
      const dayIdx = (d.getDay() + 6) % 7;
      if (dayIdx > 4) continue; // skip weekends
      if (!map[dayIdx]) map[dayIdx] = [];
      map[dayIdx].push(slot);
    }
    return map;
  }, [slots]);

  // Group appointments by day index, then layout for overlaps
  const layoutByDay = useMemo(() => {
    const byDay: Record<number, CalendarAppointment[]> = {};
    for (const appt of appointments) {
      if (appt.status === "declined") continue;
      const d = new Date(appt.scheduled_at);
      const dayIdx = (d.getDay() + 6) % 7;
      if (dayIdx > 4) continue;
      if (!byDay[dayIdx]) byDay[dayIdx] = [];
      byDay[dayIdx].push(appt);
    }
    const result: Record<number, LayoutAppt[]> = {};
    for (const dayIdx of Object.keys(byDay)) {
      result[Number(dayIdx)] = layoutAppointments(byDay[Number(dayIdx)]);
    }
    return result;
  }, [appointments]);

  // Group slots by day+hour for background rendering
  const slotGrid = useMemo(() => {
    const grid: Record<string, AppointmentSlot[]> = {};
    for (const slot of slots) {
      const d = new Date(slot.start_at);
      const dayIdx = (d.getDay() + 6) % 7;
      if (dayIdx > 4) continue;
      const hour = d.getHours();
      const key = `${dayIdx}-${hour}`;
      if (!grid[key]) grid[key] = [];
      grid[key].push(slot);
    }
    return grid;
  }, [slots]);

  const hasContent = slots.length > 0 || appointments.length > 0;

  return (
    <div>
      <PageHeader
        title="Calendario"
        description="Gestisci gli orari e visualizza gli appuntamenti"
        actions={
          <Button onClick={handleGenerateSlots} disabled={generating}>
            <Plus className="mr-2 h-4 w-4" />
            {generating ? "Generando..." : "Genera Slot"}
          </Button>
        }
      />

      {/* Week navigation */}
      <div className="mb-4 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={prevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-gray-700">
          {weekStart.toLocaleDateString("it-IT", { day: "numeric", month: "long" })} –{" "}
          {weekDates[4].toLocaleDateString("it-IT", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
        <Button variant="outline" size="sm" onClick={nextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
      )}

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-indigo-100 border border-indigo-300" />
          Prenotato
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-emerald-100 border border-emerald-300" />
          Confermato
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-100 border border-red-300" />
          No-show
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-purple-100 border-2 border-dashed border-purple-300" />
          AI Backfill
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-100 border border-green-300" />
          Slot libero
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-gray-200 border border-gray-300" />
          Bloccato
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : !hasContent ? (
        <EmptyState
          icon={<CalendarRange className="h-10 w-10" />}
          title="Nessuno slot o appuntamento per questa settimana"
          description="Genera gli slot per iniziare a gestire il calendario"
          action={
            <Button onClick={handleGenerateSlots} disabled={generating}>
              Genera Slot Settimanali
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          {/* Calendar grid using CSS grid: time-col + 5 day-cols */}
          <div
            className="grid min-w-[700px]"
            style={{ gridTemplateColumns: "56px repeat(5, 1fr)" }}
          >
            {/* ---- HEADER ROW ---- */}
            <div className="sticky top-0 z-10 border-b border-r border-gray-200 bg-gray-50 p-2 text-center text-xs font-medium text-gray-500">
              Ora
            </div>
            {weekDates.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className={`sticky top-0 z-10 border-b border-gray-200 p-2 text-center ${
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
                </div>
              );
            })}

            {/* ---- BODY: time labels column ---- */}
            <div className="relative border-r border-gray-200" style={{ height: TOTAL_HEIGHT }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-0 left-0 flex items-start justify-center border-b border-gray-100 text-[11px] font-medium text-gray-400"
                  style={{
                    top: (hour - DAY_START) * HOUR_HEIGHT,
                    height: hour < DAY_END ? HOUR_HEIGHT : 0,
                  }}
                >
                  <span className="-mt-[7px] bg-white px-1">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* ---- BODY: day columns with positioned appointments ---- */}
            {DAYS.map((_, dayIdx) => {
              const dayAppts = layoutByDay[dayIdx] ?? [];
              const daySlots = slotsByDay[dayIdx] ?? [];
              const isToday = weekDates[dayIdx].toDateString() === new Date().toDateString();

              return (
                <div
                  key={dayIdx}
                  className={`relative ${isToday ? "bg-blue-50/20" : ""}`}
                  style={{ height: TOTAL_HEIGHT }}
                >
                  {/* Hour grid lines */}
                  {HOURS.slice(0, -1).map((hour) => (
                    <div
                      key={hour}
                      className="absolute right-0 left-0 border-b border-gray-100"
                      style={{ top: (hour - DAY_START) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    >
                      {/* Half-hour dashed line */}
                      <div
                        className="absolute right-0 left-0 border-b border-dashed border-gray-50"
                        style={{ top: HOUR_HEIGHT / 2 }}
                      />
                    </div>
                  ))}

                  {/* Slot background indicators (small dot per slot) */}
                  {daySlots.map((slot) => {
                    const d = new Date(slot.start_at);
                    const startMin = d.getHours() * 60 + d.getMinutes();
                    const slotEnd = new Date(slot.end_at);
                    const endMin = slotEnd.getHours() * 60 + slotEnd.getMinutes();
                    const top = ((startMin - DAY_START * 60) / 60) * HOUR_HEIGHT;
                    const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 12);

                    // Don't show slot indicator if there's an appointment at this time
                    const hasAppt = dayAppts.some((a) => {
                      const aStart = getMinutesFromMidnight(a.scheduled_at);
                      const aEnd = aStart + a.duration_min;
                      return aStart < endMin && aEnd > startMin && a.status !== "cancelled";
                    });

                    if (hasAppt) return null;

                    return (
                      <button
                        key={slot.id}
                        onClick={() => toggleSlotBlock(slot)}
                        className={`absolute left-1 right-1 rounded border text-[10px] flex items-center gap-1 px-1 transition ${
                          slot.status === "available"
                            ? "bg-green-50/60 border-green-200 text-green-600 hover:bg-green-100"
                            : slot.status === "blocked"
                            ? "bg-gray-100/60 border-gray-200 text-gray-400 hover:bg-gray-200"
                            : "bg-blue-50/60 border-blue-200 text-blue-500"
                        }`}
                        style={{ top, height }}
                        title={
                          slot.status === "available"
                            ? "Clicca per bloccare"
                            : slot.status === "blocked"
                            ? "Clicca per sbloccare"
                            : slot.provider_name
                        }
                      >
                        {slot.status === "blocked" ? (
                          <Lock className="h-2.5 w-2.5 flex-shrink-0" />
                        ) : slot.status === "available" ? (
                          <Unlock className="h-2.5 w-2.5 flex-shrink-0 opacity-50" />
                        ) : null}
                        <span className="truncate">{slot.provider_name}</span>
                      </button>
                    );
                  })}

                  {/* Appointments — absolutely positioned by time */}
                  {dayAppts.map((appt) => {
                    const widthPct = 100 / appt.totalCols;
                    const leftPct = appt.colIndex * widthPct;
                    const isCancelled = appt.status === "cancelled";

                    return (
                      <button
                        key={appt.id}
                        onClick={() => openAppointmentDetail(appt.id)}
                        disabled={loadingAppointment}
                        className={`absolute overflow-hidden rounded-lg border text-left text-[11px] leading-tight transition-all cursor-pointer
                          ${isCancelled
                            ? "border-2 border-dashed border-purple-300 bg-purple-50/80 hover:ring-2 hover:ring-purple-300"
                            : `${STATUS_COLORS[appt.status] ?? "bg-gray-100/90 text-gray-600 border-gray-300"} hover:ring-2 hover:ring-blue-300 hover:ring-offset-1 shadow-sm`
                          }`}
                        style={{
                          top: appt.top,
                          height: appt.height,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                      >
                        <div className="flex h-full flex-col p-1.5">
                          {isCancelled ? (
                            <>
                              <div className="flex items-center gap-1 font-semibold text-purple-600">
                                <Zap className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">Slot libero</span>
                              </div>
                              {appt.height > 36 && (
                                <div className="truncate text-[10px] text-purple-400 mt-0.5">
                                  AI backfill attivo
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 flex-shrink-0 opacity-70" />
                                <span className="truncate font-semibold">
                                  {appt.patient_name}
                                </span>
                              </div>
                              {appt.height > 36 && (
                                <div className="truncate text-[10px] opacity-75 mt-0.5">
                                  {appt.service_name}
                                </div>
                              )}
                              {appt.height > 52 && appt.provider_name && (
                                <div className="truncate text-[10px] opacity-60">
                                  {appt.provider_name}
                                </div>
                              )}
                              {/* Cancel button */}
                              {appt.status !== "completed" && appt.status !== "no_show" && (
                                <button
                                  onClick={(e) => cancelAppointment(e, appt.id)}
                                  disabled={cancellingId === appt.id}
                                  title="Cancella appuntamento"
                                  className="absolute top-1 right-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:bg-red-200 hover:text-red-700 transition-all"
                                  style={{ opacity: cancellingId === appt.id ? 1 : undefined }}
                                >
                                  {cancellingId === appt.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </>
                          )}

                          {/* Time label at bottom when tall enough */}
                          {appt.height > 48 && (
                            <div className="mt-auto text-[10px] opacity-50">
                              {new Date(appt.scheduled_at).toLocaleTimeString("it-IT", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {" · "}
                              {appt.duration_min}min
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loadingAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
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
