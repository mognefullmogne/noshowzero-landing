// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

// Shared types and utilities for the AI strategy log feature.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StrategyMetadata {
  readonly strategy?: string;
  readonly reasoning?: string;
  readonly parallel_count?: number;
  readonly expiry_minutes?: number;
  readonly rebook_sent?: boolean;
  readonly ai_generated?: boolean;
  readonly [key: string]: unknown;
}

export interface StrategyEntry {
  readonly id: string;
  readonly entity_id: string;
  readonly action: string;
  readonly metadata: StrategyMetadata;
  readonly created_at: string;
}

// ---------------------------------------------------------------------------
// Badge config
// ---------------------------------------------------------------------------

export const STRATEGY_BADGE: Record<string, { label: string; className: string }> = {
  cascade: { label: "Cascade", className: "bg-blue-50 text-blue-700" },
  rebook_first: { label: "Rebook First", className: "bg-indigo-50 text-indigo-700" },
  parallel_blast: { label: "Parallel Blast", className: "bg-amber-50 text-amber-700" },
  wait_and_cascade: { label: "Wait & Cascade", className: "bg-green-50 text-green-700" },
  manual_review: { label: "Manual Review", className: "bg-red-50 text-red-700" },
};

export const ACTION_BADGE: Record<string, { label: string; className: string }> = {
  ai_strategy_applied: { label: "AI Strategy", className: "bg-indigo-50 text-indigo-700" },
  cascade_deferred: { label: "Deferred", className: "bg-amber-50 text-amber-700" },
  cascade_manual_review: { label: "Manual Review", className: "bg-red-50 text-red-700" },
  cascade_exhausted: { label: "Exhausted", className: "bg-gray-100 text-gray-600" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getStrategyBadge(strategy: string | undefined): { label: string; className: string } {
  if (!strategy) return { label: "Unknown", className: "bg-gray-100 text-gray-600" };
  return STRATEGY_BADGE[strategy] ?? { label: strategy, className: "bg-gray-100 text-gray-600" };
}

export function getActionBadge(action: string): { label: string; className: string } {
  return ACTION_BADGE[action] ?? { label: action, className: "bg-gray-100 text-gray-600" };
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable value]";
  }
}
