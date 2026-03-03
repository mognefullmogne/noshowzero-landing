"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  readonly label: string;
  readonly value: string;
  readonly change?: string;
  readonly icon: LucideIcon;
  readonly trend?: "up" | "down" | "neutral";
}

export function KpiCard({ label, value, change, icon: Icon, trend = "neutral" }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <Icon className="h-5 w-5 text-gray-300" />
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {change && (
        <p
          className={cn(
            "mt-1 text-xs",
            trend === "up" && "text-green-600",
            trend === "down" && "text-red-600",
            trend === "neutral" && "text-gray-400",
          )}
        >
          {change}
        </p>
      )}
    </div>
  );
}
