"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  Clock,
  AlertTriangle,
  Activity,
  ArrowRight,
  Loader2,
  CheckCircle,
  Gift,
  Target,
  Zap,
  Users,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// --- Types ---

interface PatientRef {
  readonly id: string;
  readonly first_name: string;
  readonly last_name: string;
}

interface RecentAppointment {
  readonly id: string;
  readonly status: string;
  readonly scheduled_at: string;
  readonly updated_at: string;
  readonly risk_score: number | null;
  readonly service_name: string;
  readonly patient: PatientRef | null;
}

interface UrgentAppointment {
  readonly id: string;
  readonly scheduled_at: string;
  readonly service_name: string;
  readonly confirmation_deadline: string;
  readonly status: string;
  readonly patient: PatientRef | null;
}

interface DashboardData {
  readonly todayCount: number;
  readonly weekCount: number;
  readonly pendingCount: number;
  readonly urgentCount: number;
  readonly urgentAppointments: readonly UrgentAppointment[];
  readonly recentActivity: readonly RecentAppointment[];
}

interface AnalyticsData {
  readonly totalAppointments: number;
  readonly noShowRate: number;
  readonly waitlistFills: number;
  readonly revenueSaved: number;
  readonly offersSent: number;
  readonly offersAccepted: number;
  readonly offersPending: number;
  readonly offerFillRate: number;
  readonly avgResponseMinutes: number | null;
}

interface OfferPreview {
  readonly id: string;
  readonly status: string;
  readonly smart_score: number | null;
  readonly offered_at: string;
  readonly patient?: { first_name: string; last_name: string } | null;
  readonly original_appointment?: { service_name: string; scheduled_at: string } | null;
}

// --- Status config ---

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Schedulato", color: "bg-gray-100 text-gray-700" },
  reminder_pending: { label: "Reminder prog.", color: "bg-amber-50 text-amber-700" },
  reminder_sent: { label: "In attesa", color: "bg-amber-50 text-amber-700" },
  confirmed: { label: "Confermato", color: "bg-green-50 text-green-700" },
  declined: { label: "Rifiutato", color: "bg-red-50 text-red-700" },
  timeout: { label: "Timeout", color: "bg-red-50 text-red-700" },
  completed: { label: "Completato", color: "bg-green-50 text-green-700" },
  no_show: { label: "No-show", color: "bg-red-50 text-red-700" },
  cancelled: { label: "Cancellato", color: "bg-gray-100 text-gray-500" },
};

interface OperationalDashboardProps {
  readonly tenantName: string;
}

export function OperationalDashboard({ tenantName }: OperationalDashboardProps) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentOffers, setRecentOffers] = useState<readonly OfferPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dashRes, analyticsRes, offersRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/analytics"),
        fetch("/api/offers?pageSize=5"),
      ]);

      if (!dashRes.ok || !analyticsRes.ok) {
        throw new Error("Errore nel caricamento dei dati");
      }

      const [dashData, analyticsData, offersData] = await Promise.all([
        dashRes.json(),
        analyticsRes.json(),
        offersRes.ok ? offersRes.json() : { success: false },
      ]);

      if (dashData.success) setDashboard(dashData.data);
      if (analyticsData.success) setAnalytics(analyticsData.data);
      if (offersData.success) setRecentOffers(offersData.data ?? []);
      setError(null);
    } catch {
      if (!silent) setError("Impossibile caricare i dati. Riprova tra qualche secondo.");
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-poll every 30 seconds
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAll(true);
      }
    }, 30_000);
    return () => clearInterval(poll);
  }, [fetchAll]);

  const today = new Date();
  const isMorning = today.getHours() < 13;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-sm text-gray-600">{error}</p>
        <Button variant="outline" size="sm" onClick={() => fetchAll()}>
          Riprova
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Morning briefing banner — visible until 1pm */}
      {isMorning && dashboard && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-3">
            Briefing del mattino —{" "}
            {today.toLocaleDateString("it-IT", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <span className="text-2xl font-bold text-blue-800">{dashboard.todayCount}</span>
              <span className="ml-1.5 text-xs text-blue-600">appuntamenti oggi</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-amber-700">{dashboard.pendingCount}</span>
              <span className="ml-1.5 text-xs text-blue-600">in attesa conferma</span>
            </div>
            <div>
              <span className={cn("text-2xl font-bold", dashboard.urgentCount > 0 ? "text-red-600" : "text-blue-800")}>
                {dashboard.urgentCount}
              </span>
              <span className="ml-1.5 text-xs text-blue-600">scadenza entro 2h</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-blue-800">{dashboard.weekCount}</span>
              <span className="ml-1.5 text-xs text-blue-600">questa settimana</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Benvenuto su {tenantName} —{" "}
            {today.toLocaleDateString("it-IT", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Aggiornamento live
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <KpiCard
          icon={CalendarDays}
          label="Oggi"
          value={dashboard?.todayCount ?? 0}
          sublabel={dashboard?.todayCount === 0 ? "nessun appuntamento" : "appuntamenti oggi"}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <KpiCard
          icon={CalendarRange}
          label="Prossimi 7 giorni"
          value={dashboard?.weekCount ?? 0}
          sublabel="appuntamenti in agenda"
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <KpiCard
          icon={Clock}
          label="Da confermare"
          value={dashboard?.pendingCount ?? 0}
          sublabel="in attesa risposta"
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Scadenza imminente"
          value={dashboard?.urgentCount ?? 0}
          sublabel="prossime 2 ore"
          iconColor={dashboard?.urgentCount ? "text-red-600" : "text-gray-400"}
          iconBg={dashboard?.urgentCount ? "bg-red-50" : "bg-gray-50"}
        />
      </div>

      {/* Two-column: Recent Activity + Urgent Deadlines */}
      <div className="grid grid-cols-1 gap-4 mb-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Attivita' recente</h2>
          </div>
          {!dashboard?.recentActivity.length ? (
            <p className="text-sm text-gray-400">Nessun appuntamento in programma</p>
          ) : (
            <ul className="space-y-2.5">
              {dashboard.recentActivity.slice(0, 10).map((a) => {
                const cfg = STATUS_CONFIG[a.status] ?? { label: a.status, color: "bg-gray-100 text-gray-700" };
                return (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <Badge className={cn("text-[10px] font-medium rounded-full shrink-0", cfg.color)}>
                      {cfg.label}
                    </Badge>
                    <span className="flex-1 truncate text-gray-700">
                      {a.patient ? `${a.patient.last_name} ${a.patient.first_name}` : "—"}
                    </span>
                    {a.risk_score != null && a.risk_score > 60 && (
                      <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 shrink-0">
                        rischio alto
                      </span>
                    )}
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(a.scheduled_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}{" "}
                      {new Date(a.scheduled_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {(dashboard?.recentActivity.length ?? 0) > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-xs text-blue-600 hover:text-blue-700"
              onClick={() => router.push("/appointments")}
            >
              Vedi tutti gli appuntamenti
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Urgent Deadlines */}
        <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700">Scadenza imminente</h2>
          </div>
          {!dashboard?.urgentAppointments.length ? (
            <div className="text-center py-6">
              <CheckCircle className="mx-auto h-8 w-8 text-green-300" />
              <p className="mt-2 text-sm text-gray-400">Nessuna scadenza urgente nelle prossime 2 ore</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {dashboard.urgentAppointments.map((a) => {
                const deadline = new Date(a.confirmation_deadline).getTime();
                const diffMin = Math.max(0, Math.round((deadline - Date.now()) / 60_000));
                return (
                  <li key={a.id} className="flex items-start gap-3 text-sm border-l-2 border-amber-400 pl-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {a.patient ? `${a.patient.last_name} ${a.patient.first_name}` : "—"}
                      </p>
                      <p className="text-xs text-gray-500">{a.service_name}</p>
                    </div>
                    <span className={cn(
                      "text-xs font-semibold shrink-0 rounded-full px-2 py-0.5",
                      diffMin < 30 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                    )}>
                      {diffMin}min
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <MiniStat
          icon={CalendarDays}
          label="Totale appuntamenti"
          value={analytics?.totalAppointments ?? 0}
          color="text-blue-600"
        />
        <MiniStat
          icon={TrendingUp}
          label="Tasso no-show"
          value={`${analytics?.noShowRate ?? 0}%`}
          color={analytics?.noShowRate && analytics.noShowRate > 10 ? "text-red-600" : "text-green-600"}
        />
        <MiniStat
          icon={Users}
          label="Slot recuperati"
          value={analytics?.waitlistFills ?? 0}
          color="text-green-600"
        />
        <MiniStat
          icon={Zap}
          label="Ricavo recuperato"
          value={analytics ? `€${analytics.revenueSaved.toLocaleString()}` : "—"}
          color="text-indigo-600"
        />
      </div>

      {/* Backfill Engine */}
      <div className="rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Backfill Engine</h2>
              <p className="text-sm text-gray-500">Recupero automatico slot cancellati</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => router.push("/offers")}
          >
            Vedi tutte le offerte
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <EngineStatCard icon={Gift} label="Offerte inviate" value={analytics?.offersSent ?? 0} color="text-blue-500" />
          <EngineStatCard icon={CheckCircle} label="Accettate" value={analytics?.offersAccepted ?? 0} color="text-green-500" />
          <EngineStatCard icon={Target} label="Tasso riempimento" value={`${analytics?.offerFillRate ?? 0}%`} color="text-indigo-500" />
          <EngineStatCard
            icon={Clock}
            label="Tempo medio risposta"
            value={
              analytics?.avgResponseMinutes != null
                ? analytics.avgResponseMinutes < 60
                  ? `${analytics.avgResponseMinutes}m`
                  : `${Math.round(analytics.avgResponseMinutes / 60)}h`
                : "—"
            }
            color="text-amber-500"
          />
        </div>

        {recentOffers.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Offerte recenti</p>
            <div className="space-y-2">
              {recentOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex items-center gap-3 rounded-xl border border-black/[0.04] px-3 py-2"
                >
                  <div className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    offer.status === "pending" && "bg-amber-400",
                    offer.status === "accepted" && "bg-green-400",
                    offer.status === "declined" && "bg-orange-400",
                    offer.status === "expired" && "bg-gray-300",
                    offer.status === "cancelled" && "bg-red-400",
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {offer.patient ? `${offer.patient.first_name} ${offer.patient.last_name}` : "Paziente"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {offer.original_appointment?.service_name ?? "Servizio"}{" "}
                      {offer.original_appointment?.scheduled_at
                        ? `· ${new Date(offer.original_appointment.scheduled_at).toLocaleDateString("it-IT")}`
                        : ""}
                    </p>
                  </div>
                  <Badge className={cn(
                    "text-[10px] font-medium rounded-full capitalize shrink-0",
                    offer.status === "pending" && "bg-amber-50 text-amber-700",
                    offer.status === "accepted" && "bg-green-50 text-green-700",
                    offer.status === "declined" && "bg-orange-50 text-orange-700",
                    offer.status === "expired" && "bg-gray-100 text-gray-500",
                    offer.status === "cancelled" && "bg-red-50 text-red-600",
                  )}>
                    {offer.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick navigation */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Appuntamenti", href: "/appointments", icon: CalendarDays, color: "bg-blue-50 text-blue-600" },
          { label: "Lista d'attesa", href: "/waitlist", icon: Users, color: "bg-green-50 text-green-600" },
          { label: "Messaggi", href: "/messages", icon: Activity, color: "bg-purple-50 text-purple-600" },
          { label: "Analytics", href: "/analytics", icon: TrendingUp, color: "bg-indigo-50 text-indigo-600" },
        ].map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className="flex items-center gap-3 rounded-2xl border border-black/[0.04] bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-blue-200 text-left"
          >
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", item.color)}>
              <item.icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-gray-900">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Sub-components ---

function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  iconColor,
  iconBg,
}: {
  readonly icon: typeof CalendarDays;
  readonly label: string;
  readonly value: number | string;
  readonly sublabel: string;
  readonly iconColor: string;
  readonly iconBg: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sublabel}</p>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  readonly icon: typeof CalendarDays;
  readonly label: string;
  readonly value: number | string;
  readonly color: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-black/[0.04] p-4 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className={cn("text-xl font-bold", color)}>{value}</p>
    </div>
  );
}

function EngineStatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  readonly icon: typeof Gift;
  readonly label: string;
  readonly value: number | string;
  readonly color: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
