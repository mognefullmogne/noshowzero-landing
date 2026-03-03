"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import type { AuditEvent } from "@/lib/types";

const ENTITY_TYPES = ["", "appointment", "waitlist", "offer", "rule", "optimization", "message"];
const ACTOR_TYPES = ["", "user", "system", "ai", "cron", "webhook"];

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entityFilter, setEntityFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");

  const fetchEvents = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (entityFilter) params.set("entity_type", entityFilter);
    if (actorFilter) params.set("actor_type", actorFilter);
    const res = await fetch(`/api/audit?${params}`);
    const json = await res.json();
    if (json.success) {
      setEvents(json.data);
      setTotalPages(json.totalPages);
    }
    setLoading(false);
  }, [page, entityFilter, actorFilter]);

  useEffect(() => {
    setLoading(true);
    fetchEvents();
  }, [fetchEvents]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Audit Trail" description="Immutable log of all system actions and changes" />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Entity Type</label>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          >
            <option value="">All entities</option>
            {ENTITY_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Actor Type</label>
          <select
            value={actorFilter}
            onChange={(e) => { setActorFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          >
            <option value="">All actors</option>
            {ACTOR_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-10 w-10" />}
          title="No audit events"
          description="Actions will be logged as you use the system"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(event.created_at).toLocaleString("it-IT", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={event.actor_type} />
                      {event.actor_id && (
                        <span className="text-xs text-gray-500 truncate max-w-[120px]">{event.actor_id}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      {event.entity_type}
                    </span>
                    {event.entity_id && (
                      <span className="ml-1 text-xs text-gray-400">{event.entity_id.slice(0, 8)}...</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{event.action}</td>
                  <td className="px-4 py-3">
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <details className="text-xs text-gray-500">
                        <summary className="cursor-pointer hover:text-gray-700">View metadata</summary>
                        <pre className="mt-1 max-w-xs overflow-auto rounded bg-gray-50 p-2 text-xs">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
