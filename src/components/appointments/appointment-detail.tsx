"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RiskBadge } from "./risk-badge";
import { StatusBadge } from "./status-badge";
import { Loader2, Brain, Bell, Clock } from "lucide-react";
import type { Appointment, Reminder } from "@/lib/types";
import { VALID_TRANSITIONS as transitions } from "@/lib/types";

interface AppointmentDetailProps {
  readonly appointment: Appointment & { reminders?: Reminder[] };
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onUpdated: () => void;
}

export function AppointmentDetail({ appointment, open, onClose, onUpdated }: AppointmentDetailProps) {
  const [scoring, setScoring] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const allowed = transitions[appointment.status] ?? [];

  async function handleAiScore() {
    setScoring(true);
    try {
      await fetch(`/api/appointments/${appointment.id}/score`, { method: "POST" });
      onUpdated();
    } catch { /* ignore */ }
    setScoring(false);
  }

  async function handleScheduleReminder() {
    setScheduling(true);
    try {
      await fetch(`/api/appointments/${appointment.id}/remind`, { method: "POST" });
      onUpdated();
    } catch { /* ignore */ }
    setScheduling(false);
  }

  async function handleStatusChange(newStatus: string) {
    setUpdating(newStatus);
    try {
      await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      onUpdated();
    } catch { /* ignore */ }
    setUpdating(null);
  }

  const patient = appointment.patient;
  const reminders = (appointment as Appointment & { reminders?: Reminder[] }).reminders ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{appointment.service_name}</span>
            <StatusBadge status={appointment.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient info */}
          {patient && (
            <div>
              <p className="text-sm font-medium text-gray-500">Patient</p>
              <p className="text-sm text-gray-900">
                {patient.first_name} {patient.last_name}
                {patient.email && <span className="text-gray-400 ml-2">({patient.email})</span>}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Scheduled</p>
              <p className="text-sm text-gray-900">
                {new Date(appointment.scheduled_at).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Duration</p>
              <p className="text-sm text-gray-900">{appointment.duration_min} min</p>
            </div>
          </div>

          {appointment.provider_name && (
            <div>
              <p className="text-sm font-medium text-gray-500">Provider</p>
              <p className="text-sm text-gray-900">{appointment.provider_name}</p>
            </div>
          )}

          {/* Risk score */}
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Risk Score</p>
            <div className="flex items-center gap-3">
              <RiskBadge score={appointment.risk_score} />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAiScore}
                disabled={scoring}
                className="text-xs"
              >
                {scoring ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Brain className="mr-1 h-3 w-3" />}
                AI Re-score
              </Button>
            </div>
            {appointment.risk_reasoning && (
              <p className="mt-1 text-xs text-gray-500">{appointment.risk_reasoning}</p>
            )}
          </div>

          <Separator />

          {/* Reminders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-500">Reminders</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleScheduleReminder}
                disabled={scheduling}
                className="text-xs"
              >
                {scheduling ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Bell className="mr-1 h-3 w-3" />}
                Schedule
              </Button>
            </div>
            {reminders.length > 0 ? (
              <div className="space-y-1.5">
                {reminders.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">
                      {new Date(r.scheduled_at).toLocaleString()}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{r.channel}</Badge>
                    <Badge
                      variant="outline"
                      className={r.status === "sent" ? "text-green-600 text-[10px]" : "text-gray-400 text-[10px]"}
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No reminders scheduled</p>
            )}
          </div>

          <Separator />

          {/* Status actions */}
          {allowed.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {allowed.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(s)}
                    disabled={updating !== null}
                    className="text-xs capitalize"
                  >
                    {updating === s && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {s.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {appointment.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-gray-500">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{appointment.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
