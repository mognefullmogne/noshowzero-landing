"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { riskLevel } from "@/lib/scoring/risk-score";

const RISK_STYLES = {
  low: "bg-green-50 text-green-700 border-green-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
} as const;

export function RiskBadge({ score }: { readonly score: number | null }) {
  if (score == null) {
    return (
      <Badge variant="outline" className="text-xs text-gray-400">
        —
      </Badge>
    );
  }

  const level = riskLevel(score);
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-semibold", RISK_STYLES[level])}
      title={`Risk score: ${score}/100`}
    >
      {score} — {level.toUpperCase()}
    </Badge>
  );
}
