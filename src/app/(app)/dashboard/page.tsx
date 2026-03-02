"use client";

import { useState, useEffect } from "react";
import {
  Key,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Zap,
  TrendingUp,
  Users,
  CalendarDays,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/hooks/use-tenant";
import { cn } from "@/lib/utils";

interface ApiKeyData {
  readonly id: string;
  readonly name: string;
  readonly key_prefix: string;
  readonly is_active: boolean;
  readonly created_at: string;
}

export default function DashboardPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [apiKeys, setApiKeys] = useState<readonly ApiKeyData[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);

  useEffect(() => {
    async function fetchKeys() {
      try {
        const res = await fetch("/api/keys");
        const data = await res.json();
        setApiKeys(data.keys ?? []);
      } catch {
        // Keys fetch may fail if Supabase isn't configured
      }
    }
    fetchKeys();
  }, []);

  async function generateKey() {
    setGeneratingKey(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Default" }),
      });
      const data = await res.json();
      if (data.key) {
        setNewKey(data.key);
        // Refresh keys list
        const keysRes = await fetch("/api/keys");
        const keysData = await keysRes.json();
        setApiKeys(keysData.keys ?? []);
      }
    } catch {
      // Key generation may fail
    }
    setGeneratingKey(false);
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const planStatus = tenant?.plan_status ?? "trialing";
  const trialEnds = tenant?.trial_ends_at
    ? new Date(tenant.trial_ends_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome to {tenant?.name ?? "NoShowZero"}
          </p>
        </div>
        <Badge
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            planStatus === "active" && "bg-green-50 text-green-700",
            planStatus === "trialing" && "bg-blue-50 text-blue-700",
            planStatus === "past_due" && "bg-yellow-50 text-yellow-700",
            planStatus === "canceled" && "bg-red-50 text-red-700",
          )}
        >
          {tenant?.plan?.toUpperCase() ?? "STARTER"} — {planStatus.replace("_", " ").toUpperCase()}
        </Badge>
      </div>

      {/* Trial banner */}
      {planStatus === "trialing" && trialEnds && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              Your free trial ends on {trialEnds}
            </p>
            <p className="text-xs text-blue-600">
              Add your payment details to continue using NoShowZero after the trial.
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => { location.assign("/billing"); }}
          >
            Upgrade
          </Button>
        </div>
      )}

      {/* Stats cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Appointments", value: "0", icon: CalendarDays, change: "—" },
          { label: "No-Show Rate", value: "0%", icon: TrendingUp, change: "—" },
          { label: "Waitlist Fills", value: "0", icon: Users, change: "—" },
          { label: "Revenue Saved", value: "$0", icon: Zap, change: "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{stat.label}</p>
              <stat.icon className="h-5 w-5 text-gray-300" />
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
            <p className="mt-1 text-xs text-gray-400">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Getting Started Checklist */}
      <div className="mt-8 rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Getting Started</h2>
        <p className="mt-1 text-sm text-gray-500">
          Complete these steps to start eliminating no-shows.
        </p>

        <div className="mt-6 space-y-4">
          {[
            {
              title: "Create your account",
              description: "Sign up and verify your email",
              done: true,
            },
            {
              title: "Set up your business",
              description: "Add your business name and industry",
              done: !!tenant?.name,
            },
            {
              title: "Generate an API key",
              description: "Get your API key for integrations",
              done: apiKeys.length > 0,
            },
            {
              title: "Connect your calendar",
              description: "Integrate with your scheduling system via API",
              done: false,
            },
            {
              title: "Send your first reminder",
              description: "Configure and test appointment reminders",
              done: false,
            },
          ].map((item, index) => (
            <div key={index} className="flex items-start gap-4">
              <div
                className={cn(
                  "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full",
                  item.done
                    ? "bg-green-100 text-green-600"
                    : "border-2 border-gray-200 text-transparent",
                )}
              >
                {item.done && <Check className="h-3.5 w-3.5" />}
              </div>
              <div>
                <p
                  className={cn(
                    "text-sm font-medium",
                    item.done ? "text-gray-400 line-through" : "text-gray-900",
                  )}
                >
                  {item.title}
                </p>
                <p className="text-xs text-gray-400">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Key Section */}
      <div className="mt-8 rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">API Keys</h2>
            <p className="mt-1 text-sm text-gray-500">
              Use your API key to authenticate requests to the NoShowZero API.
            </p>
          </div>
          <Button
            onClick={generateKey}
            disabled={generatingKey}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25"
          >
            {generatingKey ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Key className="mr-2 h-4 w-4" />
            )}
            Generate New Key
          </Button>
        </div>

        {/* Newly generated key */}
        {newKey && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-medium text-amber-700 mb-2">
              Copy this key now — it won&apos;t be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm font-mono break-all">
                {newKey}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copyKey}
                className="h-10 w-10 rounded-lg flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Existing keys */}
        {apiKeys.length > 0 ? (
          <div className="mt-4 space-y-2">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-xl border border-black/[0.04] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{key.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{key.key_prefix}</p>
                  </div>
                </div>
                <Badge
                  className={cn(
                    "rounded-full text-xs",
                    key.is_active
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700",
                  )}
                >
                  {key.is_active ? "Active" : "Revoked"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <Key className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No API keys yet</p>
            <p className="text-xs text-gray-400">
              Generate a key to start integrating with your scheduling system.
            </p>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <a
          href="https://noshowzero.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm transition-all hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <BookOpen className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">API Documentation</p>
            <p className="text-xs text-gray-500">Learn how to integrate with the NoShowZero API</p>
          </div>
          <ExternalLink className="h-4 w-4 text-gray-300" />
        </a>
        <a
          href="mailto:support@noshowzero.com"
          className="flex items-center gap-4 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm transition-all hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
            <Zap className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Get Support</p>
            <p className="text-xs text-gray-500">Contact our team for help with setup</p>
          </div>
          <ExternalLink className="h-4 w-4 text-gray-300" />
        </a>
      </div>
    </div>
  );
}
