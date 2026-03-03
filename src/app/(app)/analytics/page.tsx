"use client";

import { useState, useEffect, useCallback } from "react";
import { KpiCard } from "@/components/analytics/kpi-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  TrendingUp,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Target,
  Loader2,
} from "lucide-react";
import type { AnalyticsData } from "@/lib/types";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
      if (dateTo) params.set("to", new Date(dateTo + "T23:59:59").toISOString());

      const res = await fetch(`/api/analytics?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">Track your no-show reduction performance</p>
        </div>
      </div>

      {/* Date range filter */}
      <div className="mt-6 flex items-end gap-3">
        <div>
          <Label className="text-xs text-gray-500">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-gray-500">
            Clear
          </Button>
        )}
      </div>

      {/* KPI Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Appointments"
          value={data.totalAppointments.toLocaleString()}
          icon={CalendarDays}
        />
        <KpiCard
          label="No-Show Rate"
          value={`${data.noShowRate}%`}
          change={data.noShowRate > 15 ? "Above industry avg" : "Below industry avg"}
          trend={data.noShowRate > 15 ? "down" : "up"}
          icon={TrendingUp}
        />
        <KpiCard
          label="Waitlist Fills"
          value={data.waitlistFills.toLocaleString()}
          icon={Users}
        />
        <KpiCard
          label="Revenue Saved"
          value={`$${data.revenueSaved.toLocaleString()}`}
          icon={Zap}
          trend="up"
        />
      </div>

      {/* Detail cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Confirmed"
          value={data.confirmedCount.toLocaleString()}
          icon={CheckCircle}
          trend="up"
        />
        <KpiCard
          label="Completed"
          value={data.completedCount.toLocaleString()}
          icon={Target}
          trend="up"
        />
        <KpiCard
          label="No-Shows"
          value={data.noShowCount.toLocaleString()}
          icon={AlertTriangle}
          trend={data.noShowCount > 0 ? "down" : "neutral"}
        />
        <KpiCard
          label="Cancelled"
          value={data.cancelledCount.toLocaleString()}
          icon={XCircle}
          trend="neutral"
        />
      </div>

      {/* Average risk score */}
      <div className="mt-6 rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500">Average Risk Score</h3>
        <div className="mt-2 flex items-center gap-4">
          <p className="text-3xl font-bold text-gray-900">{data.avgRiskScore}</p>
          <div className="flex-1">
            <div className="h-3 rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all"
                style={{ width: `${data.avgRiskScore}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-gray-400">
              <span>Low Risk</span>
              <span>High Risk</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
