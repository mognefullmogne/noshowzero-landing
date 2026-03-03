"use client";

import type { SmartScoreBreakdown } from "@/lib/types";

const LABELS: { key: keyof SmartScoreBreakdown; label: string; max: number }[] = [
  { key: "urgency", label: "Urgency", max: 25 },
  { key: "reliability", label: "Reliability", max: 25 },
  { key: "timePreference", label: "Time Pref", max: 20 },
  { key: "waitingTime", label: "Waiting", max: 15 },
  { key: "distance", label: "Distance", max: 10 },
  { key: "providerMatch", label: "Provider", max: 3 },
  { key: "paymentMatch", label: "Payment", max: 2 },
];

export function ScoreBreakdown({ breakdown }: { readonly breakdown: SmartScoreBreakdown }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
        <span>Smart Score</span>
        <span>{breakdown.total}/100</span>
      </div>
      {LABELS.map(({ key, label, max }) => {
        const value = breakdown[key];
        const pct = max > 0 ? (value / max) * 100 : 0;
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="w-20 text-xs text-gray-500 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs text-gray-600">{value}/{max}</span>
          </div>
        );
      })}
    </div>
  );
}
