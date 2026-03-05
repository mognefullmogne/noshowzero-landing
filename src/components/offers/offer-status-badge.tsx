// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OfferStatus } from "@/lib/types";

const STATUS_CONFIG: Record<OfferStatus, { readonly label: string; readonly className: string }> = {
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
  accepted: { label: "Accepted", className: "bg-green-50 text-green-700 border-green-200" },
  declined: { label: "Declined", className: "bg-orange-50 text-orange-700 border-orange-200" },
  expired: { label: "Expired", className: "bg-gray-100 text-gray-500 border-gray-200" },
  cancelled: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
};

interface OfferStatusBadgeProps {
  readonly status: OfferStatus;
}

export function OfferStatusBadge({ status }: OfferStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-gray-100 text-gray-500 border-gray-200" };
  return (
    <Badge className={cn("text-xs font-medium rounded-full", config.className)}>
      {config.label}
    </Badge>
  );
}
