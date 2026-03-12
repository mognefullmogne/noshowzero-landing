// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateObj, formatTime } from "@/lib/utils/datetime";
import { MarkdownBlock } from "@/lib/render-markdown";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BriefingData {
  readonly todayCount: number;
  readonly pendingConfirmations: number;
  readonly highRiskCount: number;
  readonly activeOfferCount: number;
  readonly yesterdayNoShows: number;
  readonly yesterdayRecoveries: number;
}

interface BriefingResult {
  readonly briefing: string;
  readonly generatedAt: string;
  readonly data: BriefingData;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MorningBriefing() {
  const [result, setResult] = useState<BriefingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = refresh
        ? "/api/ai/morning-briefing?refresh=1"
        : "/api/ai/morning-briefing";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Errore nel caricamento del briefing");
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Errore sconosciuto");
      setResult({
        briefing: json.briefing,
        generatedAt: json.generatedAt,
        data: json.data,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricamento");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  const today = new Date();
  const isMorning = today.getHours() < 13;

  // Only show before 1pm
  if (!isMorning) return null;

  return (
    <div className="mb-6 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-800">Briefing del mattino</p>
            <p className="text-xs text-indigo-500">
              {formatDateObj(today, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
            AI
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100"
            onClick={() => fetchBriefing(true)}
            disabled={loading}
            title="Rigenera"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Espandi" : "Comprimi"}
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-6 pb-5">
          {loading && !result && (
            <div className="flex items-center gap-2 text-sm text-indigo-500 py-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Generazione briefing in corso...</span>
            </div>
          )}

          {error && !result && (
            <p className="text-sm text-red-600 py-2">{error}</p>
          )}

          {result && (
            <>
              <MarkdownBlock
                text={result.briefing}
                className="space-y-1 text-sm text-indigo-900 leading-relaxed"
              />
              {result.generatedAt && (
                <p className="mt-3 text-[10px] text-indigo-400">
                  Generato alle{" "}
                  {formatTime(result.generatedAt)}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
