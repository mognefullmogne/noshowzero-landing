"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClinicalUrgency } from "@/lib/types";

const URGENCY_STYLES: Record<ClinicalUrgency, string> = {
  none: "bg-gray-50 text-gray-500",
  low: "bg-green-50 text-green-700",
  medium: "bg-yellow-50 text-yellow-700",
  high: "bg-orange-50 text-orange-700",
  critical: "bg-red-50 text-red-700",
};

export function UrgencyBadge({ urgency }: { readonly urgency: ClinicalUrgency }) {
  return (
    <Badge className={cn("text-xs font-medium rounded-full capitalize", URGENCY_STYLES[urgency])}>
      {urgency}
    </Badge>
  );
}
