// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Play, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pagination } from "@/components/shared/pagination";
import type { OptimizationDecision } from "@/lib/types";
import { renderInlineMarkdown } from "@/lib/render-markdown";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  gap_fill: "Gap Fill",
  proactive_reschedule: "Proactive Reschedule",
  slot_swap: "Slot Swap",
  load_balance: "Load Balance",
};

export default function OptimizationPage() {
  const [decisions, setDecisions] = useState<OptimizationDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchDecisions = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/optimization/decisions?${params}`);
    const json = await res.json();
    if (json.success) {
      setDecisions(json.data);
      setTotalPages(json.totalPages);
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchDecisions();
  }, [fetchDecisions]);

  const runOptimization = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch("/api/optimization/run", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setRunError(data?.error?.message ?? "Failed to run optimization");
      } else {
        fetchDecisions();
      }
    } catch {
      setRunError("Network error — please try again");
    } finally {
      setRunning(false);
    }
  }, [fetchDecisions]);

  const handleDecision = useCallback(async (id: string, status: "approved" | "rejected") => {
    const previous = decisions;
    setDecisions((prev) => prev.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/optimization/decisions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setDecisions(previous);
        toast.error("Errore nell'aggiornamento della proposta");
        return;
      }
      toast.success(status === "approved" ? "Proposta approvata" : "Proposta rifiutata");
      fetchDecisions();
    } catch {
      setDecisions(previous);
      toast.error("Errore di rete — riprova");
    }
  }, [decisions, fetchDecisions]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Optimization"
        description="AI-powered calendar optimization and slot management"
        actions={
          <Button onClick={runOptimization} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {running ? "Running..." : "Run Analysis"}
          </Button>
        }
      />

      {runError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {runError}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {["", "proposed", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              statusFilter === s
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {decisions.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-10 w-10" />}
          title="No optimization decisions"
          description="Run an analysis to generate optimization proposals"
          action={<Button onClick={runOptimization}>Run Analysis</Button>}
        />
      ) : (
        <div className="space-y-3">
          {decisions.map((d) => (
            <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {TYPE_LABELS[d.type] ?? d.type}
                    </span>
                    <StatusBadge status={d.status} />
                    <span className="text-xs text-gray-400">
                      Score: {d.score}/100
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{renderInlineMarkdown(d.description)}</p>
                  {d.reasoning && (
                    <p className="mt-1 text-xs text-gray-500">{renderInlineMarkdown(d.reasoning)}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    {new Date(d.created_at).toLocaleString("it-IT")}
                  </p>
                </div>

                {d.status === "proposed" && (
                  <div className="ml-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:bg-green-50"
                      onClick={() => handleDecision(d.id, "approved")}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDecision(d.id, "rejected")}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>

              {/* Score bar */}
              <div className="mt-3">
                <div className="h-1.5 w-full rounded-full bg-gray-100">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      d.score >= 80 ? "bg-green-500" : d.score >= 50 ? "bg-amber-500" : "bg-red-400"
                    }`}
                    style={{ width: `${d.score}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
