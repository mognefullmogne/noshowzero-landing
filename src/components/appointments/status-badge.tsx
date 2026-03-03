"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/types";

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-50 text-blue-700",
  reminder_pending: "bg-sky-50 text-sky-700",
  reminder_sent: "bg-indigo-50 text-indigo-700",
  confirmed: "bg-green-50 text-green-700",
  declined: "bg-orange-50 text-orange-700",
  timeout: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  no_show: "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  reminder_pending: "Reminder Pending",
  reminder_sent: "Reminder Sent",
  confirmed: "Confirmed",
  declined: "Declined",
  timeout: "Timeout",
  completed: "Completed",
  no_show: "No Show",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { readonly status: AppointmentStatus }) {
  return (
    <Badge className={cn("text-xs font-medium rounded-full", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
