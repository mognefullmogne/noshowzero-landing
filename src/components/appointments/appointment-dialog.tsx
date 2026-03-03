"use client";

import { useState, useCallback } from "react";
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

interface AppointmentDialogProps {
  readonly onCreated: () => void;
}

type ContactChannel = "whatsapp" | "sms" | "email";

interface ContactEntry {
  readonly channel: ContactChannel;
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

const CHANNEL_PLACEHOLDERS: Record<ContactChannel, string> = {
  whatsapp: "+39 333 123 4567",
  sms: "+39 333 123 4567",
  email: "patient@example.com",
};

const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  service_name: "",
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
    { channel: "whatsapp", value: "" },
  ]);

  const updateField = useCallback(
    (field: keyof typeof INITIAL_FORM, value: string | number) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    []
  );

  const addContact = useCallback(() => {
    const usedChannels = new Set(contacts.map((c) => c.channel));
    const next = (["whatsapp", "sms", "email"] as const).find((ch) => !usedChannels.has(ch));
    if (next) {
      setContacts((prev) => [...prev, { channel: next, value: "" }]);
    }
  }, [contacts]);

  const removeContact = useCallback((index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateContact = useCallback(
    (index: number, field: "channel" | "value", val: string) => {
      setContacts((prev) =>
        prev.map((c, i) => {
          if (i !== index) return c;
          // When switching channel, clear stale value to prevent mismatched data
          if (field === "channel") return { channel: val as ContactChannel, value: "" };
          return { ...c, value: val };
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
    form.provider_name.trim() &&
    form.location_name.trim() &&
    form.scheduled_at;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Build patient contact info from entries
    const filledContacts = contacts.filter((c) => c.value.trim().length > 0);
    const phone = filledContacts.find((c) => c.channel === "whatsapp" || c.channel === "sms")?.value.trim();
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
          provider_name: form.provider_name.trim(),
          location_name: form.location_name.trim(),
          scheduled_at: form.scheduled_at,
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
      // Reset loading BEFORE closing dialog to avoid setState on unmounted component
      setLoading(false);
      setOpen(false);
      setForm(INITIAL_FORM);
      setContacts([{ channel: "whatsapp", value: "" }]);
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
                      <Input
                        value={contact.value}
                        onChange={(e) => updateContact(idx, "value", e.target.value)}
                        placeholder={CHANNEL_PLACEHOLDERS[contact.channel]}
                        type={contact.channel === "email" ? "email" : "tel"}
                        className="flex-1"
                      />
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
                <Input
                  value={form.service_name}
                  onChange={(e) => updateField("service_name", e.target.value)}
                  placeholder="e.g. Dental Checkup"
                />
              </div>
              <div>
                <Label>
                  Provider <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.provider_name}
                  onChange={(e) => updateField("provider_name", e.target.value)}
                  placeholder="e.g. Dr. Smith"
                />
              </div>
            </div>
            <div>
              <Label>
                Location <span className="text-red-500">*</span>
              </Label>
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
