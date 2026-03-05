"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  User,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import type { Appointment } from "@/lib/types";
import { AppointmentDetail } from "@/components/appointments/appointment-detail";
import { useTenant } from "@/hooks/use-tenant";
import { useRealtimeAppointments } from "@/hooks/use-realtime-appointments";

// --- Calendar layout constants ---
const DAY_START = 7; // 7:00 AM
const DAY_END = 19; // 7:00 PM
const TOTAL_HOURS = DAY_END - DAY_START; // 12 hours
const HOUR_HEIGHT = 64; // px per hour — compact but readable
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;
const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i + DAY_START);
const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven"];
const COL_GAP = 3; // px gap between overlapping appointment columns

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

/** Accent color on the left edge of each appointment card. */
const STATUS_ACCENT: Record<string, string> = {
  scheduled: "border-l-indigo-500",
  reminder_pending: "border-l-indigo-500",
  reminder_sent: "border-l-amber-500",
  confirmed: "border-l-emerald-500",
  completed: "border-l-gray-400",
  no_show: "border-l-red-500",
  cancelled: "border-l-purple-400",
  declined: "border-l-orange-500",
  timeout: "border-l-orange-500",
};

/** Background tint for the card body. */
const STATUS_BG: Record<string, string> = {
  scheduled: "bg-indigo-50 hover:bg-indigo-100/80",
  reminder_pending: "bg-indigo-50 hover:bg-indigo-100/80",
  reminder_sent: "bg-amber-50 hover:bg-amber-100/80",
  confirmed: "bg-emerald-50 hover:bg-emerald-100/80",
  completed: "bg-gray-50 hover:bg-gray-100/80",
  no_show: "bg-red-50 hover:bg-red-100/80",
  cancelled: "bg-purple-50/80 hover:bg-purple-100/60",
  declined: "bg-orange-50 hover:bg-orange-100/80",
  timeout: "bg-orange-50 hover:bg-orange-100/80",
};

const STATUS_TEXT: Record<string, string> = {
  scheduled: "text-indigo-700",
  reminder_pending: "text-indigo-700",
  reminder_sent: "text-amber-700",
  confirmed: "text-emerald-700",
  completed: "text-gray-500",
  no_show: "text-red-700",
  cancelled: "text-purple-600",
  declined: "text-orange-700",
  timeout: "text-orange-700",
};

/** Format minutes-from-midnight as "HH:MM". */
function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export default function CalendarPage() {
  const { tenant } = useTenant();
  const { appointments: realtimeAppointments } = useRealtimeAppointments(tenant?.id);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [slotsExist, setSlotsExist] = useState(false);
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
        if (slotsJson.success) setSlotsExist(slotsJson.data.length > 0);
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

  const hasContent = slotsExist || appointments.length > 0;

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
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-500">
        {[
          ["bg-indigo-500", "Prenotato"],
          ["bg-emerald-500", "Confermato"],
          ["bg-amber-500", "Promemoria"],
          ["bg-red-500", "No-show"],
          ["bg-purple-400", "AI Backfill"],
          ["bg-gray-400", "Completato"],
        ].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`} />
            {label}
          </div>
        ))}
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
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <div
            className="grid min-w-[720px]"
            style={{ gridTemplateColumns: "60px repeat(5, 1fr)" }}
          >
            {/* ---- HEADER ROW ---- */}
            <div className="sticky top-0 z-20 border-b border-r border-gray-200 bg-gray-50/95 backdrop-blur-sm p-2 text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider" />
            {weekDates.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className={`sticky top-0 z-20 border-b border-gray-200 backdrop-blur-sm py-2 px-1 text-center ${
                    isToday ? "bg-blue-50/95" : "bg-gray-50/95"
                  }`}
                >
                  <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                    {DAYS[i]}
                  </div>
                  <div
                    className={`text-base font-bold leading-tight ${
                      isToday
                        ? "mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white"
                        : "text-gray-800"
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}

            {/* ---- BODY: time labels column ---- */}
            <div className="relative border-r border-gray-200 bg-gray-50/30" style={{ height: TOTAL_HEIGHT }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-0 left-0 flex justify-end pr-2"
                  style={{
                    top: (hour - DAY_START) * HOUR_HEIGHT,
                    transform: "translateY(-50%)",
                  }}
                >
                  <span className="text-[11px] tabular-nums font-medium text-gray-400">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* ---- BODY: day columns ---- */}
            {DAYS.map((_, dayIdx) => {
              const dayAppts = layoutByDay[dayIdx] ?? [];
              const isToday = weekDates[dayIdx].toDateString() === new Date().toDateString();

              // Current-time indicator position (only for today)
              const now = new Date();
              const nowMin = now.getHours() * 60 + now.getMinutes();
              const showNowLine =
                isToday && nowMin >= DAY_START * 60 && nowMin <= DAY_END * 60;
              const nowTop = ((nowMin - DAY_START * 60) / 60) * HOUR_HEIGHT;

              return (
                <div
                  key={dayIdx}
                  className={`relative ${isToday ? "bg-blue-50/30" : ""}`}
                  style={{ height: TOTAL_HEIGHT }}
                >
                  {/* Hour grid lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute right-0 left-0 border-t border-gray-100"
                      style={{ top: (hour - DAY_START) * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Half-hour dashed lines */}
                  {HOURS.slice(0, -1).map((hour) => (
                    <div
                      key={`half-${hour}`}
                      className="absolute right-0 left-0 border-t border-dashed border-gray-100/60"
                      style={{ top: (hour - DAY_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                    />
                  ))}

                  {/* Current-time red line */}
                  {showNowLine && (
                    <div
                      className="absolute left-0 right-0 z-10 flex items-center"
                      style={{ top: nowTop }}
                    >
                      <div className="h-2 w-2 -ml-1 rounded-full bg-red-500" />
                      <div className="h-[2px] flex-1 bg-red-500" />
                    </div>
                  )}

                  {/* Appointments */}
                  {dayAppts.map((appt) => {
                    const widthPct = 100 / appt.totalCols;
                    const leftPct = appt.colIndex * widthPct;
                    const isCancelled = appt.status === "cancelled";
                    const accent = STATUS_ACCENT[appt.status] ?? "border-l-gray-400";
                    const bg = STATUS_BG[appt.status] ?? "bg-gray-50 hover:bg-gray-100/80";
                    const text = STATUS_TEXT[appt.status] ?? "text-gray-700";
                    const timeStr = formatTime(appt.scheduled_at);

                    return (
                      <button
                        key={appt.id}
                        onClick={() => openAppointmentDetail(appt.id)}
                        disabled={loadingAppointment}
                        className={`group absolute overflow-hidden rounded-md text-left transition-all cursor-pointer
                          ${isCancelled
                            ? "border border-dashed border-purple-300 bg-purple-50/60 hover:bg-purple-100/60"
                            : `border-l-[3px] ${accent} ${bg} shadow-[0_1px_2px_rgba(0,0,0,0.06)]`
                          }
                          hover:z-20 hover:shadow-md`}
                        style={{
                          top: appt.top + 1,
                          height: Math.max(appt.height - 2, 20),
                          left: `calc(${leftPct}% + ${COL_GAP}px)`,
                          width: `calc(${widthPct}% - ${COL_GAP * 2}px)`,
                        }}
                      >
                        <div className="flex h-full flex-col px-1.5 py-1">
                          {isCancelled ? (
                            <>
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-600">
                                <Zap className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">Libero</span>
                              </div>
                              {appt.height > 40 && (
                                <div className="truncate text-[10px] text-purple-400 mt-0.5">
                                  {timeStr} · {appt.duration_min}min
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Time — always visible at top */}
                              <div className={`text-[10px] font-semibold tabular-nums ${text} opacity-80`}>
                                {timeStr}
                              </div>
                              {/* Patient name */}
                              {appt.height > 28 && (
                                <div className={`truncate text-[11px] font-medium ${text} leading-tight`}>
                                  {appt.patient_name}
                                </div>
                              )}
                              {/* Service */}
                              {appt.height > 48 && (
                                <div className={`truncate text-[10px] ${text} opacity-60 mt-0.5`}>
                                  {appt.service_name}
                                </div>
                              )}
                              {/* Duration at bottom for tall cards */}
                              {appt.height > 64 && (
                                <div className={`mt-auto text-[10px] ${text} opacity-40`}>
                                  {appt.duration_min} min
                                </div>
                              )}

                              {/* Cancel button — appears on hover */}
                              {appt.status !== "completed" && appt.status !== "no_show" && (
                                <button
                                  onClick={(e) => cancelAppointment(e, appt.id)}
                                  disabled={cancellingId === appt.id}
                                  title="Cancella appuntamento"
                                  className="absolute top-0.5 right-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-opacity"
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
