// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Settings2,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Info,
  Zap,
  Clock,
  AlertTriangle,
  Bell,
  UserCheck,
  CalendarX,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import type { Ruleset } from "@/lib/types";

// ── Pre-built rule templates (human-readable) ───────────────────────────────

interface RuleTemplate {
  readonly id: string;
  readonly icon: React.ReactNode;
  readonly name: string;
  readonly description: string;
  readonly entityType: string;
  readonly conditions: readonly ConditionRow[];
  readonly actions: readonly ActionRow[];
}

interface ConditionRow {
  readonly field: string;
  readonly fieldLabel: string;
  readonly operator: string;
  readonly operatorLabel: string;
  readonly value: unknown;
  readonly valueLabel: string;
}

interface ActionRow {
  readonly type: string;
  readonly typeLabel: string;
  readonly params: Record<string, unknown>;
  readonly paramsLabel: string;
}

const RULE_TEMPLATES: readonly RuleTemplate[] = [
  {
    id: "high_risk_extra_reminder",
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    name: "Extra reminder for high-risk patients",
    description: "Send an additional reminder 2 hours before the appointment when risk score is 70 or higher.",
    entityType: "reminder",
    conditions: [
      { field: "risk_score", fieldLabel: "Risk score", operator: "gte", operatorLabel: "is at least", value: 70, valueLabel: "70" },
    ],
    actions: [
      { type: "send_extra_reminder", typeLabel: "Send extra reminder", params: { hours_before: 2, channel: "whatsapp" }, paramsLabel: "WhatsApp, 2h before" },
    ],
  },
  {
    id: "auto_confirm_low_risk",
    icon: <UserCheck className="h-5 w-5 text-green-500" />,
    name: "Auto-confirm low-risk appointments",
    description: "Skip the confirmation workflow for patients with risk score below 20 (reliable patients).",
    entityType: "appointment",
    conditions: [
      { field: "risk_score", fieldLabel: "Risk score", operator: "lt", operatorLabel: "is less than", value: 20, valueLabel: "20" },
    ],
    actions: [
      { type: "auto_confirm", typeLabel: "Auto-confirm appointment", params: {}, paramsLabel: "No confirmation needed" },
    ],
  },
  {
    id: "urgent_waitlist_priority",
    icon: <Zap className="h-5 w-5 text-red-500" />,
    name: "Prioritize urgent waitlist patients",
    description: "Automatically boost priority score for patients marked as clinically urgent (high or critical).",
    entityType: "waitlist",
    conditions: [
      { field: "clinical_urgency", fieldLabel: "Clinical urgency", operator: "in", operatorLabel: "is one of", value: ["high", "critical"], valueLabel: "High, Critical" },
    ],
    actions: [
      { type: "boost_priority", typeLabel: "Boost priority score", params: { bonus: 25 }, paramsLabel: "+25 points" },
    ],
  },
  {
    id: "short_notice_cancel_backfill",
    icon: <CalendarX className="h-5 w-5 text-blue-500" />,
    name: "Fast backfill for last-minute cancellations",
    description: "When a cancellation happens within 24 hours of the appointment, immediately send offers to the top 3 waitlist candidates.",
    entityType: "offer",
    conditions: [
      { field: "hours_until_appointment", fieldLabel: "Hours until appointment", operator: "lte", operatorLabel: "is at most", value: 24, valueLabel: "24 hours" },
    ],
    actions: [
      { type: "send_multiple_offers", typeLabel: "Send offers to multiple candidates", params: { count: 3 }, paramsLabel: "Top 3 candidates" },
    ],
  },
  {
    id: "no_show_streak_flag",
    icon: <Bell className="h-5 w-5 text-orange-500" />,
    name: "Flag repeat no-show patients",
    description: "When a patient has 3 or more no-shows, flag them for manual review and add a note to their profile.",
    entityType: "appointment",
    conditions: [
      { field: "patient_no_show_count", fieldLabel: "Patient no-show count", operator: "gte", operatorLabel: "is at least", value: 3, valueLabel: "3" },
    ],
    actions: [
      { type: "flag_for_review", typeLabel: "Flag for manual review", params: {}, paramsLabel: "Operator will be notified" },
    ],
  },
  {
    id: "optimization_auto_approve",
    icon: <Clock className="h-5 w-5 text-indigo-500" />,
    name: "Auto-approve high-confidence optimizations",
    description: "Automatically approve optimization proposals when the confidence score is 90 or higher.",
    entityType: "optimization",
    conditions: [
      { field: "score", fieldLabel: "Confidence score", operator: "gte", operatorLabel: "is at least", value: 90, valueLabel: "90" },
    ],
    actions: [
      { type: "auto_approve", typeLabel: "Auto-approve decision", params: {}, paramsLabel: "No manual review needed" },
    ],
  },
];

const OPERATOR_LABELS: Record<string, string> = {
  eq: "equals",
  neq: "does not equal",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  in: "is one of",
  not_in: "is not one of",
  contains: "contains",
};

// ── Custom rule builder types ────────────────────────────────────────────────

const FIELD_OPTIONS: Record<string, readonly { value: string; label: string }[]> = {
  appointment: [
    { value: "risk_score", label: "Risk score (0-100)" },
    { value: "status", label: "Appointment status" },
    { value: "duration_min", label: "Duration (minutes)" },
    { value: "patient_no_show_count", label: "Patient no-show count" },
    { value: "hours_until_appointment", label: "Hours until appointment" },
  ],
  waitlist: [
    { value: "clinical_urgency", label: "Clinical urgency" },
    { value: "smart_score", label: "Smart score (0-100)" },
    { value: "offers_sent", label: "Offers already sent" },
    { value: "days_waiting", label: "Days on waitlist" },
  ],
  offer: [
    { value: "hours_until_appointment", label: "Hours until appointment" },
    { value: "smart_score", label: "Candidate score" },
    { value: "offers_sent", label: "Offers already sent" },
  ],
  reminder: [
    { value: "risk_score", label: "Risk score (0-100)" },
    { value: "hours_until_appointment", label: "Hours until appointment" },
    { value: "reminder_count", label: "Reminders already sent" },
  ],
  optimization: [
    { value: "score", label: "Confidence score (0-100)" },
    { value: "type", label: "Decision type" },
  ],
};

const ACTION_OPTIONS: Record<string, readonly { value: string; label: string }[]> = {
  appointment: [
    { value: "auto_confirm", label: "Auto-confirm (skip confirmation)" },
    { value: "flag_for_review", label: "Flag for manual review" },
    { value: "add_note", label: "Add a note to the appointment" },
  ],
  waitlist: [
    { value: "boost_priority", label: "Boost priority score" },
    { value: "auto_offer", label: "Automatically send offer" },
    { value: "flag_for_review", label: "Flag for manual review" },
  ],
  offer: [
    { value: "send_multiple_offers", label: "Send offers to multiple candidates" },
    { value: "extend_expiration", label: "Extend offer expiration time" },
  ],
  reminder: [
    { value: "send_extra_reminder", label: "Send an extra reminder" },
    { value: "change_channel", label: "Switch notification channel" },
  ],
  optimization: [
    { value: "auto_approve", label: "Auto-approve the decision" },
    { value: "require_review", label: "Always require manual review" },
  ],
};

// ── Component ────────────────────────────────────────────────────────────────

export default function RulesPage() {
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  // Custom builder state
  const [customName, setCustomName] = useState("");
  const [customEntity, setCustomEntity] = useState("appointment");
  const [customField, setCustomField] = useState("");
  const [customOperator, setCustomOperator] = useState("gte");
  const [customValue, setCustomValue] = useState("");
  const [customAction, setCustomAction] = useState("");

  const [needsMigration, setNeedsMigration] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const didAutoSeedRef = useRef(false);

  const fetchRulesets = useCallback(async () => {
    try {
      const res = await fetch("/api/rules");
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.error?.message ?? "";
        // Detect if the rulesets table doesn't exist
        if (msg.includes("rulesets") || msg.includes("relation") || msg.includes("does not exist") || msg.includes("42P01")) {
          setNeedsMigration(true);
        } else {
          setRuleError("Failed to load rules — please refresh");
        }
        return;
      }
      const json = await res.json();
      if (json.success) {
        setRulesets(json.data);
        setNeedsMigration(false);
      }
    } catch {
      setRuleError("Failed to load rules — please refresh");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-seed default rules once on first visit if table is empty
  useEffect(() => {
    if (loading || needsMigration || didAutoSeedRef.current) return;
    if (rulesets.length > 0) return;

    didAutoSeedRef.current = true;
    setSeeding(true);
    setRuleError(null);

    fetch("/api/rules/seed", { method: "POST" })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setRuleError(json.error?.message ?? "Failed to seed default rules");
        }
        return fetchRulesets();
      })
      .catch(() => setRuleError("Network error — please try again"))
      .finally(() => setSeeding(false));
  }, [loading, needsMigration, rulesets.length, fetchRulesets]);

  useEffect(() => {
    fetchRulesets();
  }, [fetchRulesets]);

  const addFromTemplate = useCallback(
    async (template: RuleTemplate) => {
      setSaving(template.id);
      setRuleError(null);

      try {
        // 1. Create ruleset
        const ruleRes = await fetch("/api/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: template.name,
            description: template.description,
            entity_type: template.entityType,
            is_active: true,
          }),
        });
        const ruleJson = await ruleRes.json();

        if (!ruleJson.success) {
          setRuleError(ruleJson.error?.message ?? "Failed to create rule");
          setSaving(null);
          return;
        }

        // 2. Create version with conditions + actions
        const versionRes = await fetch(`/api/rules/${ruleJson.data.id}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conditions: template.conditions.map((c) => ({
              field: c.field,
              operator: c.operator,
              value: c.value,
            })),
            actions: template.actions.map((a) => ({
              type: a.type,
              params: a.params,
            })),
            notes: `Created from template: ${template.name}`,
          }),
        });
        const versionJson = await versionRes.json();

        if (!versionJson.success) {
          setRuleError(versionJson.error?.message ?? "Rule created but version failed");
          setSaving(null);
          await fetchRulesets();
          return;
        }

        setSaved(template.id);
        setTimeout(() => setSaved(null), 2000);
      } catch {
        setRuleError("Network error — please try again");
      }

      setSaving(null);
      await fetchRulesets();
    },
    [fetchRulesets]
  );

  const addCustomRule = useCallback(async () => {
    if (!customName || !customField || !customAction) return;
    setSaving("custom");
    setRuleError(null);

    try {
      // Parse value
      let parsedValue: unknown = customValue;
      if (!isNaN(Number(customValue))) parsedValue = Number(customValue);
      if (customValue.includes(",")) parsedValue = customValue.split(",").map((s) => s.trim());

      const ruleRes = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customName,
          entity_type: customEntity,
          is_active: true,
        }),
      });
      const ruleJson = await ruleRes.json();

      if (!ruleJson.success) {
        setRuleError(ruleJson.error?.message ?? "Failed to create rule");
        setSaving(null);
        return;
      }

      const versionRes = await fetch(`/api/rules/${ruleJson.data.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conditions: [{ field: customField, operator: customOperator, value: parsedValue }],
          actions: [{ type: customAction, params: {} }],
          notes: "Custom rule",
        }),
      });
      const versionJson = await versionRes.json();

      if (!versionJson.success) {
        setRuleError(versionJson.error?.message ?? "Rule created but version failed");
        setSaving(null);
        await fetchRulesets();
        return;
      }

      setShowCustomBuilder(false);
      setCustomName("");
      setCustomField("");
      setCustomValue("");
      setCustomAction("");
    } catch {
      setRuleError("Network error — please try again");
    }

    setSaving(null);
    await fetchRulesets();
  }, [customName, customEntity, customField, customOperator, customValue, customAction, fetchRulesets]);

  const toggleActive = useCallback(
    async (ruleset: Ruleset) => {
      setRuleError(null);
      try {
        const res = await fetch(`/api/rules/${ruleset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !ruleset.is_active }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setRuleError(data?.error?.message ?? "Failed to update rule");
          return;
        }
        await fetchRulesets();
      } catch {
        setRuleError("Network error — please try again");
      }
    },
    [fetchRulesets]
  );

  const deleteRule = useCallback(
    async (ruleset: Ruleset) => {
      if (!confirm(`Delete "${ruleset.name}"? This cannot be undone.`)) return;
      setRuleError(null);
      try {
        const res = await fetch(`/api/rules/${ruleset.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setRuleError(data?.error?.message ?? "Failed to delete rule");
          return;
        }
        await fetchRulesets();
      } catch {
        setRuleError("Network error — please try again");
      }
    },
    [fetchRulesets]
  );

  if (loading) return <LoadingSpinner />;

  if (needsMigration) {
    return (
      <div>
        <PageHeader
          title="Business Rules"
          description="Automate how your clinic handles appointments, reminders, and waitlist"
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Database Setup Required</h3>
          <p className="mb-4 text-xs text-gray-600 max-w-md mx-auto">
            The rules tables haven&apos;t been created in your database yet.
            Run the migration SQL in your Supabase Dashboard SQL Editor, then refresh this page.
          </p>
          <p className="text-xs text-gray-400">
            File: <code className="rounded bg-white px-1.5 py-0.5 text-xs">scripts/combined_migrations_004_009.sql</code>
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setNeedsMigration(false); setLoading(true); fetchRulesets(); }}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Business Rules"
        description="Automate how your clinic handles appointments, reminders, and waitlist"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={async () => {
              setSeeding(true);
              setRuleError(null);
              try {
                const res = await fetch("/api/rules/seed", { method: "POST" });
                const json = await res.json();
                if (!json.success) setRuleError(json.error?.message ?? "Failed to seed default rules");
                await fetchRulesets();
              } catch {
                setRuleError("Network error — please try again");
              } finally {
                setSeeding(false);
              }
            }} disabled={seeding}>
              {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Reset Defaults
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowGuide(!showGuide)}>
              <HelpCircle className="mr-2 h-4 w-4" />
              How it works
            </Button>
          </div>
        }
      />

      {/* Error banner */}
      {ruleError && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 flex items-center justify-between">
          <span>{ruleError}</span>
          <button onClick={() => setRuleError(null)} className="text-xs text-red-400 hover:text-red-600 ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* ── How it works guide ─────────────────────────────────────── */}
      {showGuide && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/30 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
              <div className="space-y-3 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">How Business Rules Work</p>
                <p>
                  Rules let you automate decisions so the system acts on your behalf.
                  Each rule has two parts:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-blue-100 bg-white p-3">
                    <p className="mb-1 font-medium text-blue-700">IF (Condition)</p>
                    <p className="text-xs text-gray-500">
                      When something happens that matches your criteria.
                      <br />
                      Example: <em>&quot;If risk score is at least 70&quot;</em>
                    </p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-white p-3">
                    <p className="mb-1 font-medium text-blue-700">THEN (Action)</p>
                    <p className="text-xs text-gray-500">
                      What the system should do automatically.
                      <br />
                      Example: <em>&quot;Send an extra WhatsApp reminder&quot;</em>
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                  <p className="text-xs text-gray-600">
                    <strong>Quick start:</strong> Pick a ready-made template below and click &quot;Add this rule&quot;.
                    You can turn any rule on or off at any time with the toggle switch.
                    Need something specific? Use &quot;Build your own&quot; to create a custom rule.
                  </p>
                </div>
              </div>
            </div>
            <button onClick={() => setShowGuide(false)} className="ml-4 text-xs text-gray-400 hover:text-gray-600">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Active rules ───────────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Your Rules ({rulesets.length})
        </h2>

        {rulesets.length === 0 ? (
          <EmptyState
            icon={<Settings2 className="h-10 w-10" />}
            title="No rules yet"
            description="Add a template below to get started — it takes one click"
          />
        ) : (
          <div className="space-y-2">
            {rulesets
                            .map((ruleset) => (
                <div
                  key={ruleset.id}
                  className="rounded-xl border border-gray-200 bg-white transition hover:border-gray-300"
                >
                  <div className="flex items-center gap-4 px-4 py-3">
                    {/* Toggle */}
                    <button onClick={() => toggleActive(ruleset)} title={ruleset.is_active ? "Turn off" : "Turn on"}>
                      {ruleset.is_active ? (
                        <ToggleRight className="h-7 w-7 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-7 w-7 text-gray-300" />
                      )}
                    </button>

                    {/* Info */}
                    <button
                      onClick={() => setExpandedRule(expandedRule === ruleset.id ? null : ruleset.id)}
                      className="flex flex-1 items-center justify-between text-left"
                    >
                      <div>
                        <p className={`text-sm font-medium ${ruleset.is_active ? "text-gray-900" : "text-gray-400"}`}>
                          {ruleset.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                            {ruleset.entity_type}
                          </span>
                          <span className={`text-xs ${ruleset.is_active ? "text-green-600" : "text-gray-400"}`}>
                            {ruleset.is_active ? "Active" : "Paused"}
                          </span>
                        </div>
                      </div>
                      {expandedRule === ruleset.id ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => deleteRule(ruleset)}
                      className="rounded-lg p-1.5 text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                      title="Remove rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {expandedRule === ruleset.id && (
                    <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
                      {ruleset.description ? (
                        <p className="mb-2">{ruleset.description}</p>
                      ) : null}
                      <p className="text-gray-400">
                        Created {new Date(ruleset.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Add rules section ──────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Add a Rule</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowTemplates(!showTemplates); setShowCustomBuilder(false); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                showTemplates ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              From templates
            </button>
            <button
              onClick={() => { setShowCustomBuilder(!showCustomBuilder); setShowTemplates(false); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                showCustomBuilder ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Build your own
            </button>
          </div>
        </div>

        {/* ── Templates grid ───────────────────────────────────────── */}
        {showTemplates && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RULE_TEMPLATES.map((template) => {
              const alreadyAdded = rulesets.some(
                (r) => r.name === template.name
              );
              return (
                <div
                  key={template.id}
                  className={`rounded-xl border p-4 transition ${
                    alreadyAdded ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-white hover:border-blue-200"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {template.icon}
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                      {template.entityType}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{template.name}</p>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">{template.description}</p>

                  {/* Human-readable rule */}
                  <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
                    {template.conditions.map((c, i) => (
                      <p key={i} className="text-xs text-gray-600">
                        <span className="font-medium text-blue-600">IF</span>{" "}
                        {c.fieldLabel} {c.operatorLabel}{" "}
                        <span className="font-semibold">{c.valueLabel}</span>
                      </p>
                    ))}
                    {template.actions.map((a, i) => (
                      <p key={i} className="text-xs text-gray-600">
                        <span className="font-medium text-green-600">THEN</span>{" "}
                        {a.typeLabel}{" "}
                        <span className="text-gray-400">({a.paramsLabel})</span>
                      </p>
                    ))}
                  </div>

                  <div className="mt-3">
                    {alreadyAdded ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Already added
                      </span>
                    ) : saving === template.id ? (
                      <Button size="sm" disabled className="w-full">
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Adding...
                      </Button>
                    ) : saved === template.id ? (
                      <Button size="sm" disabled className="w-full bg-green-600">
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Added!
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full" onClick={() => addFromTemplate(template)}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add this rule
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Custom builder ───────────────────────────────────────── */}
        {showCustomBuilder && (
          <div className="rounded-xl border border-blue-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Build a Custom Rule</h3>

            {/* Rule name */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">Rule name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Extra reminder for new patients"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>

            {/* Applies to */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">Applies to</label>
              <select
                value={customEntity}
                onChange={(e) => { setCustomEntity(e.target.value); setCustomField(""); setCustomAction(""); }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="appointment">Appointments</option>
                <option value="waitlist">Waitlist</option>
                <option value="offer">Offers</option>
                <option value="reminder">Reminders</option>
                <option value="optimization">Optimization</option>
              </select>
            </div>

            {/* Condition: IF ... */}
            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/30 p-3">
              <p className="mb-2 text-xs font-semibold text-blue-700">IF (condition)</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  value={customField}
                  onChange={(e) => setCustomField(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">Select a field...</option>
                  {(FIELD_OPTIONS[customEntity] ?? []).map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <select
                  value={customOperator}
                  onChange={(e) => setCustomOperator(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
                >
                  {Object.entries(OPERATOR_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="Value (e.g. 70)"
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            {/* Action: THEN ... */}
            <div className="mb-4 rounded-lg border border-green-100 bg-green-50/30 p-3">
              <p className="mb-2 text-xs font-semibold text-green-700">THEN (action)</p>
              <select
                value={customAction}
                onChange={(e) => setCustomAction(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">Select what should happen...</option>
                {(ACTION_OPTIONS[customEntity] ?? []).map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>

            {/* Preview */}
            {customField && customValue && customAction && (
              <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                <span className="font-medium text-blue-600">IF</span>{" "}
                {FIELD_OPTIONS[customEntity]?.find((f) => f.value === customField)?.label ?? customField}{" "}
                {OPERATOR_LABELS[customOperator]}{" "}
                <span className="font-semibold">{customValue}</span>{" "}
                <span className="font-medium text-green-600">THEN</span>{" "}
                {ACTION_OPTIONS[customEntity]?.find((a) => a.value === customAction)?.label ?? customAction}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!customName || !customField || !customValue || !customAction || saving === "custom"}
                onClick={addCustomRule}
              >
                {saving === "custom" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Rule
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCustomBuilder(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
