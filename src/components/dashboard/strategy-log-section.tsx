"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  ArrowRight,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrategyMetadata {
  readonly strategy?: string;
  readonly reasoning?: string;
  readonly parallel_count?: number;
  readonly expiry_minutes?: number;
  readonly rebook_sent?: boolean;
  readonly ai_generated?: boolean;
  readonly [key: string]: unknown;
}

interface StrategyEntry {
  readonly id: string;
  readonly entity_id: string;
  readonly action: string;
  readonly metadata: StrategyMetadata;
  readonly created_at: string;
}

interface StrategyLogSectionProps {
  readonly className?: string;
}

// ---------------------------------------------------------------------------
// Strategy badge config
// ---------------------------------------------------------------------------

const STRATEGY_BADGE: Record<string, { label: string; className: string }> = {
  cascade: { label: "Cascade", className: "bg-blue-50 text-blue-700" },
  rebook_first: { label: "Rebook First", className: "bg-indigo-50 text-indigo-700" },
  parallel_blast: { label: "Parallel Blast", className: "bg-amber-50 text-amber-700" },
  wait_and_cascade: { label: "Wait & Cascade", className: "bg-green-50 text-green-700" },
  manual_review: { label: "Manual Review", className: "bg-red-50 text-red-700" },
};

const ACTION_LABEL: Record<string, string> = {
  ai_strategy_applied: "AI Strategy",
  cascade_deferred: "Deferred",
  cascade_manual_review: "Manual Review",
  cascade_exhausted: "Exhausted",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStrategyBadge(strategy: string | undefined): { label: string; className: string } {
  if (!strategy) return { label: "Unknown", className: "bg-gray-100 text-gray-600" };
  return STRATEGY_BADGE[strategy] ?? { label: strategy, className: "bg-gray-100 text-gray-600" };
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StrategyLogSection({ className }: StrategyLogSectionProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<readonly StrategyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/strategy-log?limit=5");
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error ?? "Failed to load strategy log");
      }

      setEntries(json.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategy log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className={cn("rounded-2xl border border-black/[0.04] bg-white shadow-sm", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-black/[0.04]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
            <Brain className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Strategy Log</h2>
            <p className="text-xs text-gray-500">Recent AI decisions and reasoning</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-blue-600 hover:text-blue-700"
          onClick={() => router.push("/strategy-log")}
        >
          View all
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-2 px-5 py-3 bg-red-50 border-b border-red-100">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs text-red-600"
            onClick={fetchEntries}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
          <Brain className="h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">No strategy decisions yet</p>
          <p className="text-xs text-gray-400 max-w-xs">
            AI strategy decisions will appear here as the system handles cancellations and no-shows.
          </p>
        </div>
      )}

      {/* Entry list */}
      {!loading && !error && entries.length > 0 && (
        <div className="divide-y divide-black/[0.04]">
          {entries.map((entry) => {
            const badge = getStrategyBadge(entry.metadata.strategy);
            const isExpanded = expandedId === entry.id;

            return (
              <div key={entry.id} className="px-5 py-3">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => handleToggleExpand(entry.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  )}

                  <Badge className={cn("text-[10px] font-medium rounded-full shrink-0", badge.className)}>
                    {badge.label}
                  </Badge>

                  <span className="flex-1 text-xs text-gray-700 truncate">
                    {ACTION_LABEL[entry.action] ?? entry.action}
                    {entry.entity_id && (
                      <span className="ml-1.5 text-gray-400">
                        · {truncateId(entry.entity_id)}
                      </span>
                    )}
                  </span>

                  <span className="text-[10px] text-gray-400 shrink-0">
                    {formatTimestamp(entry.created_at)}
                  </span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-2 ml-7 rounded-lg bg-gray-50 p-3">
                    {entry.metadata.reasoning && (
                      <div className="mb-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">
                          AI Reasoning
                        </p>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          {entry.metadata.reasoning}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
                      {entry.metadata.parallel_count != null && (
                        <span>Parallel: {entry.metadata.parallel_count}</span>
                      )}
                      {entry.metadata.expiry_minutes != null && (
                        <span>Expiry: {entry.metadata.expiry_minutes}m</span>
                      )}
                      {entry.metadata.rebook_sent != null && (
                        <span>Rebook sent: {entry.metadata.rebook_sent ? "Yes" : "No"}</span>
                      )}
                      {entry.metadata.ai_generated != null && (
                        <span>AI: {entry.metadata.ai_generated ? "Yes" : "Rule"}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
