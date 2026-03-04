"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  BarChart3,
  Zap,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_FILTERS = [
  { value: "", label: "All actions" },
  { value: "ai_strategy_applied", label: "AI Strategy Applied" },
  { value: "cascade_deferred", label: "Cascade Deferred" },
  { value: "cascade_manual_review", label: "Manual Review" },
  { value: "cascade_exhausted", label: "Cascade Exhausted" },
] as const;

const STRATEGY_BADGE: Record<string, { label: string; className: string }> = {
  cascade: { label: "Cascade", className: "bg-blue-50 text-blue-700" },
  rebook_first: { label: "Rebook First", className: "bg-indigo-50 text-indigo-700" },
  parallel_blast: { label: "Parallel Blast", className: "bg-amber-50 text-amber-700" },
  wait_and_cascade: { label: "Wait & Cascade", className: "bg-green-50 text-green-700" },
  manual_review: { label: "Manual Review", className: "bg-red-50 text-red-700" },
};

const ACTION_BADGE: Record<string, { label: string; className: string }> = {
  ai_strategy_applied: { label: "AI Strategy", className: "bg-indigo-50 text-indigo-700" },
  cascade_deferred: { label: "Deferred", className: "bg-amber-50 text-amber-700" },
  cascade_manual_review: { label: "Manual Review", className: "bg-red-50 text-red-700" },
  cascade_exhausted: { label: "Exhausted", className: "bg-gray-100 text-gray-600" },
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStrategyBadge(strategy: string | undefined): { label: string; className: string } {
  if (!strategy) return { label: "Unknown", className: "bg-gray-100 text-gray-600" };
  return STRATEGY_BADGE[strategy] ?? { label: strategy, className: "bg-gray-100 text-gray-600" };
}

function getActionBadge(action: string): { label: string; className: string } {
  return ACTION_BADGE[action] ?? { label: action, className: "bg-gray-100 text-gray-600" };
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

// ---------------------------------------------------------------------------
// KPI computations (pure functions, no mutation)
// ---------------------------------------------------------------------------

interface KpiSummary {
  readonly totalDecisions: number;
  readonly mostCommonStrategy: string;
  readonly aiVsRuleRatio: string;
  readonly avgDecisionsPerDay: number;
}

function computeKpis(entries: readonly StrategyEntry[]): KpiSummary {
  if (entries.length === 0) {
    return { totalDecisions: 0, mostCommonStrategy: "—", aiVsRuleRatio: "—", avgDecisionsPerDay: 0 };
  }

  // Count strategies
  const strategyCounts: Record<string, number> = {};
  let aiCount = 0;
  let ruleCount = 0;

  for (const entry of entries) {
    const strategy = entry.metadata.strategy ?? "unknown";
    strategyCounts[strategy] = (strategyCounts[strategy] ?? 0) + 1;

    if (entry.metadata.ai_generated) {
      aiCount += 1;
    } else {
      ruleCount += 1;
    }
  }

  // Find most common strategy
  const sortedStrategies = Object.entries(strategyCounts).sort(([, a], [, b]) => b - a);
  const topStrategy = sortedStrategies[0]?.[0] ?? "—";
  const topLabel = STRATEGY_BADGE[topStrategy]?.label ?? topStrategy;

  // AI vs rule ratio
  const ratio = ruleCount > 0 ? `${aiCount}:${ruleCount}` : `${aiCount}:0`;

  // Average decisions per day
  const timestamps = entries.map((e) => new Date(e.created_at).getTime());
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const daySpan = Math.max(1, Math.ceil((maxTs - minTs) / (1000 * 60 * 60 * 24)));
  const avgPerDay = Math.round((entries.length / daySpan) * 10) / 10;

  return {
    totalDecisions: entries.length,
    mostCommonStrategy: topLabel,
    aiVsRuleRatio: ratio,
    avgDecisionsPerDay: avgPerDay,
  };
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function StrategyLogPage() {
  const [entries, setEntries] = useState<readonly StrategyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const fetchEntries = useCallback(async (pageNum: number, action: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (action) params.set("action", action);

      const res = await fetch(`/api/ai/strategy-log?${params}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error ?? "Failed to load strategy log");
      }

      const allEntries: readonly StrategyEntry[] = json.entries ?? [];
      // Client-side pagination since API only supports limit
      const startIdx = (pageNum - 1) * PAGE_SIZE;
      const pageEntries = allEntries.slice(0, PAGE_SIZE);

      setEntries(pageEntries);
      setHasMore(json.count >= PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategy log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(page, actionFilter);
  }, [fetchEntries, page, actionFilter]);

  const handleFilterChange = useCallback((value: string) => {
    setActionFilter(value);
    setPage(1);
    setExpandedId(null);
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const kpis = computeKpis(entries);

  return (
    <div>
      <PageHeader
        title="AI Strategy Log"
        description="Review AI-powered backfill strategy decisions and reasoning"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => fetchEntries(page, actionFilter)}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <KpiCard
          icon={BarChart3}
          label="Total Decisions"
          value={kpis.totalDecisions}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <KpiCard
          icon={Brain}
          label="Most Common"
          value={kpis.mostCommonStrategy}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <KpiCard
          icon={Zap}
          label="AI vs Rule"
          value={kpis.aiVsRuleRatio}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <KpiCard
          icon={BarChart3}
          label="Avg/Day"
          value={kpis.avgDecisionsPerDay}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
      </div>

      {/* Filter */}
      <div className="mb-6">
        <label className="mb-1 block text-xs font-medium text-gray-500">Action Type</label>
        <select
          value={actionFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
        >
          {ACTION_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-xs text-red-600"
              onClick={() => fetchEntries(page, actionFilter)}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <EmptyState
          icon={<Brain className="h-10 w-10" />}
          title="No strategy decisions"
          description="AI strategy decisions will appear here as the system handles cancellations and no-shows."
        />
      )}

      {/* Entry table */}
      {!loading && !error && entries.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_120px_140px_140px] gap-3 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
            <span className="w-5" />
            <span className="text-xs font-medium text-gray-500">Strategy</span>
            <span className="text-xs font-medium text-gray-500">Action</span>
            <span className="text-xs font-medium text-gray-500">Appointment</span>
            <span className="text-xs font-medium text-gray-500 text-right">Timestamp</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {entries.map((entry) => {
              const stratBadge = getStrategyBadge(entry.metadata.strategy);
              const actBadge = getActionBadge(entry.action);
              const isExpanded = expandedId === entry.id;

              return (
                <div key={entry.id} className="hover:bg-gray-50/50">
                  <button
                    type="button"
                    className="grid w-full grid-cols-[auto_1fr_120px_140px_140px] gap-3 px-4 py-3 text-left items-center"
                    onClick={() => handleToggleExpand(entry.id)}
                  >
                    <span className="w-5 flex items-center justify-center">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </span>

                    <div>
                      <Badge className={cn("text-[10px] font-medium rounded-full", stratBadge.className)}>
                        {stratBadge.label}
                      </Badge>
                    </div>

                    <div>
                      <Badge className={cn("text-[10px] font-medium rounded-full", actBadge.className)}>
                        {actBadge.label}
                      </Badge>
                    </div>

                    <span className="text-xs text-gray-500 truncate">
                      {entry.entity_id ? truncateId(entry.entity_id) : "—"}
                    </span>

                    <span className="text-xs text-gray-400 text-right">
                      {formatTimestamp(entry.created_at)}
                    </span>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="ml-8 rounded-lg border border-black/[0.04] bg-gray-50 p-4">
                        {entry.metadata.reasoning && (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                              AI Reasoning
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {entry.metadata.reasoning}
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <MetadataItem
                            label="Strategy"
                            value={stratBadge.label}
                          />
                          <MetadataItem
                            label="Appointment ID"
                            value={entry.entity_id || "—"}
                          />
                          {entry.metadata.parallel_count != null && (
                            <MetadataItem
                              label="Parallel Count"
                              value={String(entry.metadata.parallel_count)}
                            />
                          )}
                          {entry.metadata.expiry_minutes != null && (
                            <MetadataItem
                              label="Expiry"
                              value={`${entry.metadata.expiry_minutes} min`}
                            />
                          )}
                          {entry.metadata.rebook_sent != null && (
                            <MetadataItem
                              label="Rebook Sent"
                              value={entry.metadata.rebook_sent ? "Yes" : "No"}
                            />
                          )}
                          <MetadataItem
                            label="Decision Type"
                            value={entry.metadata.ai_generated ? "AI-generated" : "Rule-based"}
                          />
                        </div>

                        {/* Raw metadata fallback for extra fields */}
                        <RawMetadata metadata={entry.metadata} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && entries.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} {hasMore ? "" : "(last)"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  icon: Icon,
  label,
  value,
  iconColor,
  iconBg,
}: {
  readonly icon: typeof BarChart3;
  readonly label: string;
  readonly value: number | string;
  readonly iconColor: string;
  readonly iconBg: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function MetadataItem({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">
        {label}
      </p>
      <p className="text-xs text-gray-700 break-all">{value}</p>
    </div>
  );
}

/** Show extra metadata keys not covered by the known fields */
function RawMetadata({ metadata }: { readonly metadata: StrategyMetadata }) {
  const knownKeys = new Set([
    "strategy", "reasoning", "parallel_count", "expiry_minutes", "rebook_sent", "ai_generated",
  ]);

  const extraEntries = Object.entries(metadata).filter(([key]) => !knownKeys.has(key));

  if (extraEntries.length === 0) return null;

  return (
    <details className="mt-3 text-xs text-gray-500">
      <summary className="cursor-pointer hover:text-gray-700 font-medium">
        Additional metadata ({extraEntries.length} fields)
      </summary>
      <pre className="mt-1 overflow-auto rounded bg-white border border-gray-200 p-2 text-xs">
        {JSON.stringify(Object.fromEntries(extraEntries), null, 2)}
      </pre>
    </details>
  );
}
