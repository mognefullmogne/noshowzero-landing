"use client";

import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  // Appointment statuses
  scheduled: "bg-blue-50 text-blue-700",
  confirmed: "bg-green-50 text-green-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-600",
  no_show: "bg-red-50 text-red-700",
  declined: "bg-orange-50 text-orange-700",
  timeout: "bg-yellow-50 text-yellow-700",
  reminder_pending: "bg-indigo-50 text-indigo-600",
  reminder_sent: "bg-purple-50 text-purple-700",
  // Offer statuses
  pending: "bg-amber-50 text-amber-700",
  accepted: "bg-green-50 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  // Waitlist statuses
  waiting: "bg-blue-50 text-blue-700",
  offer_pending: "bg-amber-50 text-amber-700",
  fulfilled: "bg-green-50 text-green-700",
  // Optimization
  proposed: "bg-blue-50 text-blue-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  executed: "bg-emerald-50 text-emerald-700",
  // Workflow
  pending_send: "bg-yellow-50 text-yellow-700",
  message_sent: "bg-blue-50 text-blue-700",
  timed_out: "bg-orange-50 text-orange-700",
  // Slots
  available: "bg-green-50 text-green-700",
  booked: "bg-blue-50 text-blue-700",
  blocked: "bg-gray-100 text-gray-600",
  // Urgency
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-50 text-orange-700",
  medium: "bg-yellow-50 text-yellow-700",
  low: "bg-blue-50 text-blue-600",
  none: "bg-gray-50 text-gray-500",
  // Default
  default: "bg-gray-100 text-gray-600",
};

interface StatusBadgeProps {
  readonly status: string;
  readonly className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] ?? STATUS_COLORS.default;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        colorClass,
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
