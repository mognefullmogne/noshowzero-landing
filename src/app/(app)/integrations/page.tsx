// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CalendarDays,
  Mail,
  Link2,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Trash2,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// -- Types --

interface Integration {
  id: string;
  provider: string;
  label: string | null;
  status: string;
  last_sync_at: string | null;
  error_message: string | null;
  calendar_ids: string[];
  created_at: string;
}

interface ImportLogEntry {
  id: string;
  provider: string;
  status: string;
  total_events: number;
  imported: number;
  skipped: number;
  failed: number;
  started_at: string;
  completed_at: string | null;
}

interface CalendarOption {
  id: string;
  summary: string;
  primary: boolean;
}

// -- Main Page --

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [importLogs, setImportLogs] = useState<ImportLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Dialog states
  const [icalDialogOpen, setIcalDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [calendarSelectorOpen, setCalendarSelectorOpen] = useState(false);
  const [calendarSelectorProvider, setCalendarSelectorProvider] = useState<
    "google" | "outlook"
  >("google");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations");
      const json = await res.json();
      if (json.success) {
        setIntegrations(json.data.integrations);
        setImportLogs(json.data.importLogs);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check URL params for post-OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    if (connected === "google" || connected === "outlook") {
      setCalendarSelectorProvider(connected);
      setCalendarSelectorOpen(true);
      // Clean URL
      window.history.replaceState({}, "", "/integrations");
    }
  }, []);

  const handleSync = async (integrationId: string) => {
    setSyncing(integrationId);
    try {
      await fetch(`/api/integrations/${integrationId}/sync`, {
        method: "POST",
      });
      await fetchData();
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (integrationId: string) => {
    if (!confirm("Eliminare questa integrazione?")) return;
    await fetch(`/api/integrations/${integrationId}`, { method: "DELETE" });
    await fetchData();
  };

  const handleTogglePause = async (integration: Integration) => {
    const newStatus = integration.status === "paused" ? "active" : "paused";
    await fetch(`/api/integrations/${integration.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchData();
  };

  const getIntegration = (provider: string) =>
    integrations.find((i) => i.provider === provider);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Integrazioni
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Importa i tuoi appuntamenti dal tuo calendario e lascia che NowShow
          li gestisca con l&apos;intelligenza artificiale.
        </p>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <IntegrationCard
          icon={<CalendarDays className="h-6 w-6 text-blue-600" />}
          title="Google Calendar"
          description="Connetti il tuo Google Calendar"
          integration={getIntegration("google")}
          onConnect={() => (window.location.href = "/api/integrations/google/auth")}
          onSync={(id) => handleSync(id)}
          onDelete={(id) => handleDelete(id)}
          onTogglePause={(i) => handleTogglePause(i)}
          syncing={syncing}
        />
        <IntegrationCard
          icon={<Mail className="h-6 w-6 text-indigo-600" />}
          title="Outlook Calendar"
          description="Connetti il tuo Outlook Calendar"
          integration={getIntegration("outlook")}
          onConnect={() => (window.location.href = "/api/integrations/outlook/auth")}
          onSync={(id) => handleSync(id)}
          onDelete={(id) => handleDelete(id)}
          onTogglePause={(i) => handleTogglePause(i)}
          syncing={syncing}
        />
        <IntegrationCard
          icon={<Link2 className="h-6 w-6 text-green-600" />}
          title="iCal Feed"
          description="Aggiungi un feed iCal (.ics)"
          integration={getIntegration("ical")}
          onConnect={() => setIcalDialogOpen(true)}
          onSync={(id) => handleSync(id)}
          onDelete={(id) => handleDelete(id)}
          onTogglePause={(i) => handleTogglePause(i)}
          syncing={syncing}
        />
        <CsvCard
          integration={getIntegration("csv")}
          onUpload={() => setCsvDialogOpen(true)}
        />
      </div>

      {/* Import History */}
      {importLogs.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Cronologia importazioni
          </h2>
          <div className="rounded-xl border border-black/[0.04] bg-white">
            <div className="divide-y divide-black/[0.04]">
              {importLogs.map((log) => (
                <ImportLogRow key={log.id} log={log} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ICalDialog
        open={icalDialogOpen}
        onClose={() => setIcalDialogOpen(false)}
        onSuccess={fetchData}
      />
      <CsvUploadDialog
        open={csvDialogOpen}
        onClose={() => setCsvDialogOpen(false)}
        onSuccess={fetchData}
      />
      <CalendarSelectorDialog
        open={calendarSelectorOpen}
        onClose={() => setCalendarSelectorOpen(false)}
        provider={calendarSelectorProvider}
        integration={getIntegration(calendarSelectorProvider)}
        onSuccess={fetchData}
      />
    </div>
  );
}

// -- Integration Card --

function IntegrationCard({
  icon,
  title,
  description,
  integration,
  onConnect,
  onSync,
  onDelete,
  onTogglePause,
  syncing,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  integration: Integration | undefined;
  onConnect: () => void;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePause: (i: Integration) => void;
  syncing: string | null;
}) {
  const isConnected = !!integration;
  const isSyncing = syncing === integration?.id;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50">
            {icon}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
        {integration && <StatusBadge status={integration.status} />}
      </div>

      {integration && (
        <div className="mt-3 space-y-2">
          {integration.last_sync_at && (
            <p className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              Ultimo sync: {formatRelative(integration.last_sync_at)}
            </p>
          )}
          {integration.error_message && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              {integration.error_message}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {!isConnected ? (
          <Button size="sm" onClick={onConnect}>
            Connetti
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSync(integration!.id)}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              Sincronizza
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onTogglePause(integration!)}
            >
              {integration!.status === "paused" ? (
                <Play className="h-3 w-3" />
              ) : (
                <Pause className="h-3 w-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-600"
              onClick={() => onDelete(integration!.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

// -- CSV Card --

function CsvCard({
  integration,
  onUpload,
}: {
  integration: Integration | undefined;
  onUpload: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50">
            <FileSpreadsheet className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">CSV Upload</p>
            <p className="text-xs text-gray-500">
              Carica un file CSV con appuntamenti
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Button size="sm" onClick={onUpload}>
          <Upload className="mr-1 h-3 w-3" />
          Carica CSV
        </Button>
      </div>
    </Card>
  );
}

// -- Status Badge --

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <Badge variant="secondary" className="bg-green-50 text-green-700">
          Attivo
        </Badge>
      );
    case "paused":
      return (
        <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">
          In pausa
        </Badge>
      );
    case "error":
      return (
        <Badge variant="secondary" className="bg-red-50 text-red-700">
          Errore
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-gray-50 text-gray-600">
          {status}
        </Badge>
      );
  }
}

// -- Import Log Row --

function ImportLogRow({ log }: { log: ImportLogEntry }) {
  const providerIcons: Record<string, React.ReactNode> = {
    google: <CalendarDays className="h-4 w-4 text-blue-600" />,
    outlook: <Mail className="h-4 w-4 text-indigo-600" />,
    ical: <Link2 className="h-4 w-4 text-green-600" />,
    csv: <FileSpreadsheet className="h-4 w-4 text-orange-600" />,
  };

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50">
          {providerIcons[log.provider] ?? null}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {providerLabel(log.provider)}
          </p>
          <p className="text-xs text-gray-500">
            {formatDateTime(log.started_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          {log.imported} importati
        </span>
        {log.skipped > 0 && (
          <span className="text-gray-400">{log.skipped} saltati</span>
        )}
        {log.failed > 0 && (
          <span className="flex items-center gap-1 text-red-500">
            <XCircle className="h-3 w-3" />
            {log.failed} errori
          </span>
        )}
        <LogStatusBadge status={log.status} />
      </div>
    </div>
  );
}

function LogStatusBadge({ status }: { status: string }) {
  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  }
  if (status === "failed") {
    return <XCircle className="h-4 w-4 text-red-500" />;
  }
  return <CheckCircle2 className="h-4 w-4 text-green-500" />;
}

// -- iCal Dialog --

function ICalDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "ical",
          ical_url: url,
          label: label || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Errore durante l'importazione");
        return;
      }
      onSuccess();
      onClose();
      setUrl("");
      setLabel("");
    } catch {
      setError("Errore di rete");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiungi feed iCal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ical-url">URL del feed iCal (.ics)</Label>
            <Input
              id="ical-url"
              placeholder="https://calendar.google.com/...basic.ics"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ical-label">Nome (opzionale)</Label>
            <Input
              id="ical-label"
              placeholder="Il mio calendario"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!url || submitting}
            className="w-full"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Importa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -- CSV Upload Dialog --

function CsvUploadDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    failed: number;
    errors: { eventSummary: string; reason: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setResult(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/integrations/csv/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Errore durante il caricamento");
        return;
      }
      setResult(json.data);
      onSuccess();
    } catch {
      setError("Errore di rete");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carica file CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!result ? (
            <>
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 p-8 transition-colors hover:border-blue-300 hover:bg-blue-50/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mb-2 h-8 w-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-600">
                  {file ? file.name : "Clicca o trascina il file CSV"}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Max 5 MB, 10.000 righe
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-600">
                  Formati supportati:
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
                  <li>Google Calendar export (.csv)</li>
                  <li>Outlook export (.csv)</li>
                  <li>
                    Generico: data, ora, durata, servizio, paziente, telefono
                  </li>
                </ul>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full"
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Importa
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <p className="font-medium text-gray-900">
                  Importazione completata
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StatBox
                  label="Importati"
                  value={result.imported}
                  color="green"
                />
                <StatBox
                  label="Saltati"
                  value={result.skipped}
                  color="gray"
                />
                <StatBox label="Errori" value={result.failed} color="red" />
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg bg-red-50 p-2">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">
                      {e.eventSummary}: {e.reason}
                    </p>
                  ))}
                </div>
              )}
              <Button onClick={handleClose} className="w-full" variant="outline">
                Chiudi
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -- Calendar Selector Dialog --

function CalendarSelectorDialog({
  open,
  onClose,
  provider,
  integration,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  provider: "google" | "outlook";
  integration: Integration | undefined;
  onSuccess: () => void;
}) {
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/integrations/${provider}/calendars`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setCalendars(json.data.calendars);
          setSelected(new Set(json.data.selectedIds));
        }
      })
      .finally(() => setLoading(false));
  }, [open, provider]);

  const toggleCalendar = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!integration) return;
    setSaving(true);
    try {
      await fetch(`/api/integrations/${integration.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendar_ids: Array.from(selected) }),
      });

      // Trigger initial sync
      setSyncing(true);
      await fetch(`/api/integrations/${integration.id}/sync`, {
        method: "POST",
      });

      onSuccess();
      onClose();
    } finally {
      setSaving(false);
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Seleziona calendari da{" "}
            {provider === "google" ? "Google" : "Outlook"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : calendars.length === 0 ? (
            <p className="text-sm text-gray-500">Nessun calendario trovato</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {calendars.map((cal) => (
                <label
                  key={cal.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-black/[0.04] p-3 transition-colors hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(cal.id)}
                    onChange={() => toggleCalendar(cal.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {cal.summary}
                    </p>
                    {cal.primary && (
                      <span className="text-xs text-gray-400">Principale</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={selected.size === 0 || saving || syncing}
            className="w-full"
          >
            {saving || syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {syncing
              ? "Importazione in corso..."
              : `Importa da ${selected.size} calendari`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -- Stat Box --

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "gray" | "red";
}) {
  const colors = {
    green: "text-green-700 bg-green-50",
    gray: "text-gray-600 bg-gray-50",
    red: "text-red-700 bg-red-50",
  };

  return (
    <div className={`rounded-lg p-3 text-center ${colors[color]}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

// -- Helpers --

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    google: "Google Calendar",
    outlook: "Outlook Calendar",
    ical: "iCal Feed",
    csv: "CSV Upload",
  };
  return labels[provider] ?? provider;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "ora";
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.round(hours / 24);
  return `${days}g fa`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
