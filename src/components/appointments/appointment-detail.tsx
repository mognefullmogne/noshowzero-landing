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
import { Loader2, Brain, Bell, Clock, Gift, User, Bot, Send } from "lucide-react";
import type { Appointment, Reminder, OfferStatus } from "@/lib/types";
import { VALID_TRANSITIONS as transitions } from "@/lib/types";
import { AppointmentAiChat } from "./appointment-ai-chat";

interface OfferSummary {
  readonly id: string;
  readonly status: OfferStatus;
  readonly smart_score: number | null;
  readonly offered_at: string;
  readonly responded_at: string | null;
  readonly patient?: { first_name: string; last_name: string } | null;
}

interface AppointmentDetailProps {
  readonly appointment: Appointment & { reminders?: Reminder[]; offers?: OfferSummary[] };
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onUpdated: () => void;
}

export function AppointmentDetail({ appointment, open, onClose, onUpdated }: AppointmentDetailProps) {
  const [scoring, setScoring] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "ai">("details");

  const allowed = transitions[appointment.status] ?? [];

  async function handleAiScore() {
    setScoring(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/score`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error?.message ?? "Failed to re-score");
        return;
      }
      onUpdated();
    } catch {
      setActionError("Network error — please try again");
    } finally {
      setScoring(false);
    }
  }

  async function handleScheduleReminder() {
    setScheduling(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/remind`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error?.message ?? "Failed to schedule reminder");
        return;
      }
      onUpdated();
    } catch {
      setActionError("Network error — please try again");
    } finally {
      setScheduling(false);
    }
  }

  async function handleSendConfirmation() {
    setSendingConfirmation(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}/send-confirmation`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error?.message ?? "Failed to send confirmation");
        return;
      }
      onUpdated();
    } catch {
      setActionError("Network error — please try again");
    } finally {
      setSendingConfirmation(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setUpdating(newStatus);
    setActionError(null);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error?.message ?? "Failed to update status");
        return;
      }
      onUpdated();
    } catch {
      setActionError("Network error — please try again");
    } finally {
      setUpdating(null);
    }
  }

  const patient = appointment.patient;
  const reminders = (appointment as Appointment & { reminders?: Reminder[] }).reminders ?? [];
  const offers = (appointment as Appointment & { offers?: OfferSummary[] }).offers ?? [];
  const isCancelledOrNoShow = appointment.status === "cancelled" || appointment.status === "no_show";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{appointment.service_name}</span>
            <StatusBadge status={appointment.status} />
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "details"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "ai"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Bot className="h-3 w-3" />
            AI Chat
          </button>
        </div>

        {/* AI Chat tab — kept mounted to preserve conversation */}
        <div className={activeTab === "ai" ? "" : "hidden"}>
          <AppointmentAiChat appointmentId={appointment.id} />
        </div>

        {/* Details tab */}
        <div className={`space-y-4 max-h-[60vh] overflow-y-auto ${activeTab === "details" ? "" : "hidden"}`}>
          {/* Error banner */}
          {actionError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {actionError}
            </div>
          )}

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
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendConfirmation}
                  disabled={sendingConfirmation || isCancelledOrNoShow || appointment.status === "completed"}
                  className="text-xs"
                >
                  {sendingConfirmation ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
                  Send Confirmation
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleScheduleReminder}
                  disabled={scheduling}
                  className="text-xs"
                >
                  {scheduling ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Bell className="mr-1 h-3 w-3" />}
                  Schedule Reminder
                </Button>
              </div>
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

          {/* Backfill offers section */}
          {isCancelledOrNoShow && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="h-4 w-4 text-purple-500" />
                  <p className="text-sm font-medium text-gray-500">Backfill Engine</p>
                </div>
                {offers.length > 0 ? (
                  <div className="space-y-2">
                    {offers.map((offer) => {
                      const offerPatient = offer.patient;
                      return (
                        <div
                          key={offer.id}
                          className="flex items-center gap-2 rounded-lg border border-black/[0.04] px-3 py-2"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
                            <User className="h-3 w-3 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">
                              {offerPatient
                                ? `${offerPatient.first_name} ${offerPatient.last_name}`
                                : "Patient"}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(offer.offered_at).toLocaleString()}
                              {offer.smart_score != null && ` · Score: ${offer.smart_score}`}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              offer.status === "accepted" ? "text-green-600 border-green-200" :
                              offer.status === "pending" ? "text-amber-600 border-amber-200" :
                              offer.status === "declined" ? "text-orange-600 border-orange-200" :
                              "text-gray-400 border-gray-200"
                            }`}
                          >
                            {offer.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    No offers sent yet. The engine will find a match if waitlist candidates are available.
                  </p>
                )}
              </div>
            </>
          )}

          {appointment.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-gray-500">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{appointment.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
