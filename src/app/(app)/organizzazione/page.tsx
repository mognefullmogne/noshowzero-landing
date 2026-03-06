// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Building2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────

interface Service {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly duration_min: number;
  readonly price: number | null;
  readonly currency: string;
  readonly is_active: boolean;
}

interface Operator {
  readonly id: string;
  readonly name: string;
  readonly role: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly is_active: boolean;
}

// ── Service Dialog ──────────────────────────────────────────────────

const EMPTY_SERVICE = {
  name: "",
  description: "",
  duration_min: 30,
  price: "",
  currency: "EUR",
  is_active: true,
};

function ServiceDialog({
  service,
  onSave,
  onClose,
}: {
  service: Service | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    service
      ? {
          name: service.name,
          description: service.description ?? "",
          duration_min: service.duration_min,
          price: service.price !== null ? String(service.price) : "",
          currency: service.currency,
          is_active: service.is_active,
        }
      : EMPTY_SERVICE
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      duration_min: Number(form.duration_min),
      price: form.price !== "" ? Number(form.price) : null,
      currency: form.currency,
      is_active: form.is_active,
    };

    try {
      const res = await fetch(
        service ? `/api/services/${service.id}` : "/api/services",
        {
          method: service ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? "Errore nel salvataggio");
        setLoading(false);
        return;
      }
      onSave();
    } catch {
      setError("Errore di rete — riprova");
      setLoading(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {service ? "Modifica Servizio" : "Nuovo Servizio"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>
            Nome <span className="text-red-500">*</span>
          </Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="es. Taglio Uomo"
            required
          />
        </div>
        <div>
          <Label>Descrizione</Label>
          <Textarea
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            rows={2}
            placeholder="Descrizione opzionale"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>
              Durata (min) <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min={1}
              max={480}
              value={form.duration_min}
              onChange={(e) =>
                setForm((p) => ({ ...p, duration_min: Number(e.target.value) }))
              }
              required
            />
          </div>
          <div>
            <Label>Prezzo</Label>
            <div className="flex gap-1.5">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) =>
                  setForm((p) => ({ ...p, price: e.target.value }))
                }
                placeholder="0.00"
                className="flex-1"
              />
              <Input
                value={form.currency}
                onChange={(e) =>
                  setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))
                }
                maxLength={3}
                className="w-16 text-center"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={form.is_active}
            onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
          />
          <Label>Attivo</Label>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" disabled={loading || !form.name.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

// ── Operator Dialog ─────────────────────────────────────────────────

const EMPTY_OPERATOR = {
  name: "",
  role: "",
  phone: "",
  email: "",
  is_active: true,
};

function OperatorDialog({
  operator,
  services,
  onSave,
  onClose,
}: {
  operator: Operator | null;
  services: readonly Service[];
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    operator
      ? {
          name: operator.name,
          role: operator.role ?? "",
          phone: operator.phone ?? "",
          email: operator.email ?? "",
          is_active: operator.is_active,
        }
      : EMPTY_OPERATOR
  );
  const [assignedServices, setAssignedServices] = useState<readonly string[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing service assignments when editing
  useEffect(() => {
    if (!operator) return;
    fetch(`/api/operators/${operator.id}/services`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAssignedServices(d.data);
      })
      .catch(() => {});
  }, [operator]);

  function toggleService(serviceId: string) {
    setAssignedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      role: form.role.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      is_active: form.is_active,
    };

    try {
      const res = await fetch(
        operator ? `/api/operators/${operator.id}` : "/api/operators",
        {
          method: operator ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? "Errore nel salvataggio");
        setLoading(false);
        return;
      }

      // Save service assignments
      const operatorId = operator?.id ?? data.data.id;
      await fetch(`/api/operators/${operatorId}/services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_ids: assignedServices }),
      });

      onSave();
    } catch {
      setError("Errore di rete — riprova");
      setLoading(false);
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {operator ? "Modifica Operator" : "Nuovo Operator"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>
            Nome <span className="text-red-500">*</span>
          </Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="es. Marco"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ruolo</Label>
            <Input
              value={form.role}
              onChange={(e) =>
                setForm((p) => ({ ...p, role: e.target.value }))
              }
              placeholder="es. Stilista"
            />
          </div>
          <div>
            <Label>Telefono</Label>
            <Input
              value={form.phone}
              onChange={(e) =>
                setForm((p) => ({ ...p, phone: e.target.value }))
              }
              placeholder="+39 333..."
              type="tel"
            />
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <Input
            value={form.email}
            onChange={(e) =>
              setForm((p) => ({ ...p, email: e.target.value }))
            }
            placeholder="operator@esempio.it"
            type="email"
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={form.is_active}
            onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
          />
          <Label>Attivo</Label>
        </div>

        {/* Service assignments */}
        {services.length > 0 && (
          <div>
            <Label className="mb-2 block">Servizi assegnati</Label>
            <div className="space-y-1.5">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => toggleService(svc.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                    assignedServices.includes(svc.id)
                      ? "border-blue-200 bg-blue-50 text-blue-800"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <span>
                    {svc.name}{" "}
                    <span className="text-xs text-gray-400">
                      ({svc.duration_min}min)
                    </span>
                  </span>
                  {assignedServices.includes(svc.id) && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" disabled={loading || !form.name.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

type Tab = "servizi" | "operators";

export default function OrganizzazionePage() {
  const [tab, setTab] = useState<Tab>("servizi");
  const [services, setServices] = useState<readonly Service[]>([]);
  const [operators, setOperators] = useState<readonly Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<Service | null | undefined>(undefined);
  const [editingOperator, setEditingOperator] = useState<Operator | null | undefined>(undefined);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [svcRes, opRes] = await Promise.all([
        fetch("/api/services"),
        fetch("/api/operators"),
      ]);
      const [svcData, opData] = await Promise.all([
        svcRes.json(),
        opRes.json(),
      ]);
      if (svcData.success) setServices(svcData.data);
      if (opData.success) setOperators(opData.data);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function deleteService(id: string) {
    if (!confirm("Eliminare questo servizio?")) return;
    await fetch(`/api/services/${id}`, { method: "DELETE" });
    fetchAll();
  }

  async function deleteOperator(id: string) {
    if (!confirm("Eliminare questo operator?")) return;
    await fetch(`/api/operators/${id}`, { method: "DELETE" });
    fetchAll();
  }

  // editingService/Operator: undefined = dialog closed, null = new, object = editing
  const isServiceDialogOpen = editingService !== undefined;
  const isOperatorDialogOpen = editingOperator !== undefined;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Organizzazione</h1>
            <p className="text-sm text-gray-500">
              Gestisci servizi e operatori
            </p>
          </div>
        </div>
        {tab === "servizi" ? (
          <Button
            onClick={() => setEditingService(null)}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Servizio
          </Button>
        ) : (
          <Button
            onClick={() => setEditingOperator(null)}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Operator
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {(["servizi", "operators"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t === "servizi" ? "Servizi" : "Operatori"}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : tab === "servizi" ? (
        <ServicesTable
          services={services}
          onEdit={setEditingService}
          onDelete={deleteService}
        />
      ) : (
        <OperatorsTable
          operators={operators}
          services={services}
          onEdit={setEditingOperator}
          onDelete={deleteOperator}
        />
      )}

      {/* Service Dialog */}
      <Dialog
        open={isServiceDialogOpen}
        onOpenChange={(open) => {
          if (!open) setEditingService(undefined);
        }}
      >
        {isServiceDialogOpen && (
          <ServiceDialog
            service={editingService ?? null}
            onSave={() => {
              setEditingService(undefined);
              fetchAll();
            }}
            onClose={() => setEditingService(undefined)}
          />
        )}
      </Dialog>

      {/* Operator Dialog */}
      <Dialog
        open={isOperatorDialogOpen}
        onOpenChange={(open) => {
          if (!open) setEditingOperator(undefined);
        }}
      >
        {isOperatorDialogOpen && (
          <OperatorDialog
            operator={editingOperator ?? null}
            services={services}
            onSave={() => {
              setEditingOperator(undefined);
              fetchAll();
            }}
            onClose={() => setEditingOperator(undefined)}
          />
        )}
      </Dialog>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function ServicesTable({
  services,
  onEdit,
  onDelete,
}: {
  services: readonly Service[];
  onEdit: (s: Service) => void;
  onDelete: (id: string) => void;
}) {
  if (services.length === 0) {
    return (
      <EmptyState
        title="Nessun servizio"
        description="Aggiungi il primo servizio offerto."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Nome</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Durata</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Prezzo</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Stato</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {services.map((svc) => (
            <tr
              key={svc.id}
              className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{svc.name}</div>
                {svc.description && (
                  <div className="text-xs text-gray-400 truncate max-w-xs">
                    {svc.description}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600">{svc.duration_min} min</td>
              <td className="px-4 py-3 text-gray-600">
                {svc.price !== null
                  ? `${svc.price} ${svc.currency}`
                  : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant={svc.is_active ? "default" : "secondary"}
                  className={svc.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                >
                  {svc.is_active ? "Attivo" : "Inattivo"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                    onClick={() => onEdit(svc)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                    onClick={() => onDelete(svc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OperatorsTable({
  operators,
  services,
  onEdit,
  onDelete,
}: {
  operators: readonly Operator[];
  services: readonly Service[];
  onEdit: (o: Operator) => void;
  onDelete: (id: string) => void;
}) {
  if (operators.length === 0) {
    return (
      <EmptyState
        title="Nessun operatore"
        description="Aggiungi il primo operatore del tuo staff."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Nome</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Ruolo</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Contatti</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Stato</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {operators.map((op) => (
            <tr
              key={op.id}
              className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
            >
              <td className="px-4 py-3 font-medium text-gray-900">{op.name}</td>
              <td className="px-4 py-3 text-gray-600">
                {op.role ?? <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-gray-600">
                <div className="flex flex-col gap-0.5">
                  {op.phone && <span className="text-xs">{op.phone}</span>}
                  {op.email && <span className="text-xs">{op.email}</span>}
                  {!op.phone && !op.email && (
                    <span className="text-gray-300">—</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant={op.is_active ? "default" : "secondary"}
                  className={op.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                >
                  {op.is_active ? "Attivo" : "Inattivo"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                    onClick={() => onEdit(op)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                    onClick={() => onDelete(op.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
      <Building2 className="h-10 w-10 text-gray-300 mb-3" />
      <p className="font-medium text-gray-500">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{description}</p>
    </div>
  );
}
