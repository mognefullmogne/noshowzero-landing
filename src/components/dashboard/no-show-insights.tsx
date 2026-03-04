"use client";

import { useState, useCallback } from "react";
import { AlertTriangle, BarChart2, Loader2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NoShowAggregates } from "@/lib/ai/no-show-analysis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoShowInsightsProps {
  readonly className?: string;
}

interface AnalysisState {
  readonly analysis: string;
  readonly data: NoShowAggregates;
  readonly generatedAt: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NoShowInsights({ className }: NoShowInsightsProps) {
  const [state, setState] = useState<AnalysisState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchAnalysis = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const url = refresh
        ? "/api/ai/no-show-analysis?refresh=true"
        : "/api/ai/no-show-analysis";
      const res = await fetch(url);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "Errore sconosciuto");
      }

      setState({
        analysis: json.analysis,
        data: json.data,
        generatedAt: json.generatedAt,
      });
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricamento dell'analisi");
    } finally {
      setLoading(false);
    }
  }, []);

  const formattedTime = state?.generatedAt
    ? new Date(state.generatedAt).toLocaleString("it-IT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className={cn("rounded-2xl border border-black/[0.04] bg-white shadow-sm", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-black/[0.04]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <BarChart2 className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Analisi No-Show</h2>
            <p className="text-xs text-gray-500">Cause radice e raccomandazioni AI</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {state && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => fetchAnalysis(true)}
              disabled={loading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
              Aggiorna analisi
            </Button>
          )}

          {!state && !loading && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => fetchAnalysis(false)}
            >
              <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
              Genera analisi
            </Button>
          )}

          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analisi in corso...
            </div>
          )}

          {state && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-400"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 px-5 py-3 bg-red-50 border-b border-red-100">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Empty state — no analysis yet */}
      {!state && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
          <BarChart2 className="h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">
            Nessuna analisi disponibile
          </p>
          <p className="text-xs text-gray-400 max-w-xs">
            Clicca "Genera analisi" per analizzare i pattern no-show degli ultimi 90 giorni
            con intelligenza artificiale.
          </p>
        </div>
      )}

      {/* KPI summary row */}
      {state && (
        <div className="grid grid-cols-3 divide-x divide-black/[0.04] border-b border-black/[0.04]">
          <KpiCell
            label="Tasso no-show"
            value={`${state.data.overallNoShowRate}%`}
            sub={`${state.data.totalNoShows} su ${state.data.totalAppointments}`}
            highlight={state.data.overallNoShowRate > 20}
          />
          <KpiCell
            label="Pazienti cronici"
            value={String(state.data.repeatOffenders.length)}
            sub="3+ no-show in 90 giorni"
            highlight={state.data.repeatOffenders.length > 0}
          />
          <KpiCell
            label="Giorno peggiore"
            value={getWorstDay(state.data)}
            sub="tasso no-show piu' alto"
          />
        </div>
      )}

      {/* Collapsible analysis body */}
      {state && expanded && (
        <div className="p-5">
          <MarkdownAnalysis text={state.analysis} />
        </div>
      )}

      {/* Footer */}
      {state && (
        <div className="px-5 py-3 border-t border-black/[0.04]">
          <p className="text-xs text-gray-400">
            Ultimo aggiornamento: {formattedTime ?? "—"}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCell({
  label,
  value,
  sub,
  highlight = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub: string;
  readonly highlight?: boolean;
}) {
  return (
    <div className="px-5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">{label}</p>
      <p className={cn("text-xl font-bold", highlight ? "text-amber-600" : "text-gray-900")}>{value}</p>
      <p className="text-[10px] text-gray-400">{sub}</p>
    </div>
  );
}

/**
 * Minimal markdown renderer — supports ## headings, **bold**, and bullet lists.
 * Avoids bringing in a heavy markdown library.
 */
function MarkdownAnalysis({ text }: { readonly text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1 text-sm text-gray-700">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="text-sm font-semibold text-gray-900 mt-4 mb-1 first:mt-0">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="text-xs font-semibold text-gray-800 mt-3 mb-0.5">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 text-xs text-gray-600">
              <span className="shrink-0 text-gray-400 mt-0.5">•</span>
              <span>{renderBold(line.slice(2))}</span>
            </div>
          );
        }
        if (line.match(/^\d+\. /)) {
          return (
            <div key={i} className="flex gap-2 text-xs text-gray-600">
              <span className="shrink-0 text-gray-500 font-medium">{line.match(/^\d+/)?.[0]}.</span>
              <span>{renderBold(line.replace(/^\d+\. /, ""))}</span>
            </div>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-1" />;
        }
        return (
          <p key={i} className="text-xs text-gray-600 leading-relaxed">
            {renderBold(line)}
          </p>
        );
      })}
    </div>
  );
}

/** Render **bold** segments as <strong> inline. */
function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-gray-800">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWorstDay(data: NoShowAggregates): string {
  if (data.byDayOfWeek.length === 0) return "—";
  const worst = [...data.byDayOfWeek].sort((a, b) => b.rate - a.rate)[0];
  return worst ? worst.dayName : "—";
}
