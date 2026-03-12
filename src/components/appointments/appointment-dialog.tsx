// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Phone, Mail, MessageCircle, X } from "lucide-react";

interface ServiceOption {
  readonly id: string;
  readonly name: string;
  readonly duration_min: number;
}

interface OperatorOption {
  readonly id: string;
  readonly name: string;
}

interface AppointmentDialogProps {
  readonly onCreated: () => void;
}

type ContactChannel = "whatsapp" | "sms" | "email";

interface ContactEntry {
  readonly channel: ContactChannel;
  readonly prefix: string;
  readonly value: string;
}

const CHANNEL_LABELS: Record<ContactChannel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
};

const CHANNEL_ICONS: Record<ContactChannel, typeof Phone> = {
  whatsapp: MessageCircle,
  sms: Phone,
  email: Mail,
};

const PHONE_PREFIXES = [
  { code: "+39", country: "IT", flag: "🇮🇹" },
  { code: "+1", country: "US", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+49", country: "DE", flag: "🇩🇪" },
  { code: "+33", country: "FR", flag: "🇫🇷" },
  { code: "+34", country: "ES", flag: "🇪🇸" },
  { code: "+41", country: "CH", flag: "🇨🇭" },
  { code: "+43", country: "AT", flag: "🇦🇹" },
  { code: "+31", country: "NL", flag: "🇳🇱" },
  { code: "+32", country: "BE", flag: "🇧🇪" },
  { code: "+351", country: "PT", flag: "🇵🇹" },
  { code: "+55", country: "BR", flag: "🇧🇷" },
  { code: "+61", country: "AU", flag: "🇦🇺" },
  { code: "+81", country: "JP", flag: "🇯🇵" },
  { code: "+86", country: "CN", flag: "🇨🇳" },
  { code: "+91", country: "IN", flag: "🇮🇳" },
] as const;

const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  service_id: "",
  service_name: "",
  operator_id: "",
  provider_name: "",
  location_name: "",
  scheduled_at: "",
  duration_min: 30,
  notes: "",
};

export function AppointmentDialog({ onCreated }: AppointmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [contacts, setContacts] = useState<readonly ContactEntry[]>([
    { channel: "whatsapp", prefix: "+39", value: "" },
  ]);
  const [services, setServices] = useState<readonly ServiceOption[]>([]);
  const [operators, setOperators] = useState<readonly OperatorOption[]>([]);

  // Load services when dialog opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/services?active=true")
      .then((r) => r.json())
      .then((d) => { if (d.success) setServices(d.data); })
      .catch(() => {});
  }, [open]);

  // Load operators when service changes
  useEffect(() => {
    if (!open) return;
    const url = form.service_id
      ? `/api/operators?active=true&service_id=${form.service_id}`
      : "/api/operators?active=true";
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (d.success) setOperators(d.data); })
      .catch(() => {});
  }, [open, form.service_id]);

  const updateField = useCallback(
    (field: keyof typeof INITIAL_FORM, value: string | number) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    []
  );

  const handleServiceChange = useCallback(
    (serviceId: string) => {
      const svc = services.find((s) => s.id === serviceId);
      setForm((prev) => ({
        ...prev,
        service_id: serviceId,
        service_name: svc?.name ?? "",
        duration_min: svc?.duration_min ?? prev.duration_min,
        // Reset operator when service changes
        operator_id: "",
        provider_name: "",
      }));
    },
    [services]
  );

  const handleOperatorChange = useCallback(
    (operatorId: string) => {
      const op = operators.find((o) => o.id === operatorId);
      setForm((prev) => ({
        ...prev,
        operator_id: operatorId,
        provider_name: op?.name ?? "",
      }));
    },
    [operators]
  );

  const addContact = useCallback(() => {
    const usedChannels = new Set(contacts.map((c) => c.channel));
    const next = (["whatsapp", "sms", "email"] as const).find((ch) => !usedChannels.has(ch));
    if (next) {
      setContacts((prev) => [...prev, { channel: next, prefix: "+39", value: "" }]);
    }
  }, [contacts]);

  const removeContact = useCallback((index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateContact = useCallback(
    (index: number, field: "channel" | "value" | "prefix", val: string) => {
      setContacts((prev) =>
        prev.map((c, i) => {
          if (i !== index) return c;
          if (field === "channel") return { channel: val as ContactChannel, prefix: c.prefix, value: "" };
          return { ...c, [field]: val };
        })
      );
    },
    []
  );

  const hasValidContact = contacts.some((c) => c.value.trim().length > 0);

  const canSubmit =
    form.first_name.trim() &&
    form.last_name.trim() &&
    hasValidContact &&
    form.service_name.trim() &&
    form.scheduled_at;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Build patient contact info from entries
    const filledContacts = contacts.filter((c) => c.value.trim().length > 0);
    const phoneContact = filledContacts.find((c) => c.channel === "whatsapp" || c.channel === "sms");
    const phone = phoneContact ? `${phoneContact.prefix}${phoneContact.value.trim().replace(/^0+/, "")}` : undefined;
    const email = filledContacts.find((c) => c.channel === "email")?.value.trim();
    const preferredChannel = filledContacts[0]?.channel ?? "whatsapp";

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            phone: phone || undefined,
            email: email || undefined,
            preferred_channel: preferredChannel,
          },
          service_name: form.service_name.trim(),
          service_id: form.service_id || undefined,
          provider_name: form.provider_name.trim() || undefined,
          operator_id: form.operator_id || undefined,
          location_name: form.location_name.trim() || undefined,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
          duration_min: form.duration_min,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? "Failed to create appointment");
        setLoading(false);
        return;
      }
      setLoading(false);
      setOpen(false);
      setForm(INITIAL_FORM);
      setContacts([{ channel: "whatsapp", prefix: "+39", value: "" }]);
      setServices([]);
      setOperators([]);
      onCreated();
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
          <Plus className="mr-2 h-4 w-4" />
          New Appointment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Appointment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* --- Patient Info --- */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Patient
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => updateField("first_name", e.target.value)}
                  placeholder="Mario"
                />
              </div>
              <div>
                <Label>
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
                  placeholder="Rossi"
                />
              </div>
            </div>

            {/* Contact channels */}
            <div>
              <Label>
                Contact <span className="text-red-500">*</span>
                <span className="ml-1 text-xs font-normal text-gray-400">
                  (at least one)
                </span>
              </Label>
              <div className="mt-1.5 space-y-2">
                {contacts.map((contact, idx) => {
                  const Icon = CHANNEL_ICONS[contact.channel];
                  const isPhone = contact.channel !== "email";
                  return (
                    <div key={contact.channel} className="flex items-center gap-2">
                      <Select
                        value={contact.channel}
                        onValueChange={(v) => updateContact(idx, "channel", v)}
                      >
                        <SelectTrigger className="w-32 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 text-gray-500" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {(["whatsapp", "sms", "email"] as const).map((ch) => (
                            <SelectItem key={ch} value={ch}>
                              {CHANNEL_LABELS[ch]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isPhone ? (
                        <div className="flex flex-1 gap-1.5">
                          <Select
                            value={contact.prefix}
                            onValueChange={(v) => updateContact(idx, "prefix", v)}
                          >
                            <SelectTrigger className="w-24 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PHONE_PREFIXES.map((p) => (
                                <SelectItem key={p.code} value={p.code}>
                                  {p.flag} {p.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={contact.value}
                            onChange={(e) => updateContact(idx, "value", e.target.value)}
                            placeholder="333 123 4567"
                            type="tel"
                            className="flex-1"
                          />
                        </div>
                      ) : (
                        <Input
                          value={contact.value}
                          onChange={(e) => updateContact(idx, "value", e.target.value)}
                          placeholder="patient@example.com"
                          type="email"
                          className="flex-1"
                        />
                      )}
                      {contacts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeContact(idx)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                {contacts.length < 3 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addContact}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add contact method
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* --- Appointment Info --- */}
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Appointment
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Service <span className="text-red-500">*</span>
                </Label>
                {services.length > 0 ? (
                  <Select
                    value={form.service_id}
                    onValueChange={handleServiceChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona servizio" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.duration_min}min)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.service_name}
                    onChange={(e) => updateField("service_name", e.target.value)}
                    placeholder="e.g. Dental Checkup"
                  />
                )}
              </div>
              <div>
                <Label>Provider</Label>
                {operators.length > 0 ? (
                  <Select
                    value={form.operator_id}
                    onValueChange={handleOperatorChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona operatore" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.provider_name}
                    onChange={(e) => updateField("provider_name", e.target.value)}
                    placeholder="e.g. Dr. Smith"
                  />
                )}
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={form.location_name}
                onChange={(e) => updateField("location_name", e.target.value)}
                placeholder="e.g. Main Clinic"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Date & Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => updateField("scheduled_at", e.target.value)}
                />
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  value={form.duration_min}
                  onChange={(e) => updateField("duration_min", Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={2}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Appointment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
