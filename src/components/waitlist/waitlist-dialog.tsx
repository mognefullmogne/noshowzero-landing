"use client";

import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2 } from "lucide-react";
import type { Patient, ClinicalUrgency } from "@/lib/types";

interface WaitlistDialogProps {
  readonly onCreated: () => void;
}

export function WaitlistDialog({ onCreated }: WaitlistDialogProps) {
  const [open, setOpen] = useState(false);
  const [patients, setPatients] = useState<readonly Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    patient_id: "",
    service_name: "",
    preferred_provider: "",
    location_name: "",
    clinical_urgency: "none" as ClinicalUrgency,
    flexible_time: true,
    distance_km: "",
  });

  useEffect(() => {
    if (open) {
      fetch("/api/patients?pageSize=100")
        .then((r) => r.json())
        .then((d) => { if (d.success) setPatients(d.data); })
        .catch(() => {});
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          distance_km: form.distance_km ? Number(form.distance_km) : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? "Failed to add to waitlist");
        setLoading(false);
        return;
      }
      setOpen(false);
      setForm({ patient_id: "", service_name: "", preferred_provider: "", location_name: "", clinical_urgency: "none", flexible_time: true, distance_km: "" });
      onCreated();
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
          <Plus className="mr-2 h-4 w-4" />
          Add to Waitlist
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Waitlist Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Patient</Label>
            <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select patient..." /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Service</Label>
              <Input
                required
                value={form.service_name}
                onChange={(e) => setForm({ ...form, service_name: e.target.value })}
                placeholder="e.g. Dental Checkup"
              />
            </div>
            <div>
              <Label>Preferred Provider</Label>
              <Input
                value={form.preferred_provider}
                onChange={(e) => setForm({ ...form, preferred_provider: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Clinical Urgency</Label>
              <Select
                value={form.clinical_urgency}
                onValueChange={(v) => setForm({ ...form, clinical_urgency: v as ClinicalUrgency })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["none", "low", "medium", "high", "critical"] as const).map((u) => (
                    <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Distance (km)</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={form.distance_km}
                onChange={(e) => setForm({ ...form, distance_km: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <Label>Location</Label>
            <Input
              value={form.location_name}
              onChange={(e) => setForm({ ...form, location_name: e.target.value })}
              placeholder="e.g. Main Clinic"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.flexible_time}
              onCheckedChange={(v) => setForm({ ...form, flexible_time: v })}
            />
            <Label className="text-sm">Flexible with time</Label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.patient_id || !form.service_name}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Entry
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
