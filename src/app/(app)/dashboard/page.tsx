"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Key,
  Copy,
  Check,
  BookOpen,
  AlertCircle,
  Loader2,
  ArrowRight,
  Plug,
  Bell,
  Info,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/hooks/use-tenant";
import { cn } from "@/lib/utils";
import { OperationalDashboard } from "@/components/dashboard/operational-dashboard";

interface ApiKeyData {
  readonly id: string;
  readonly name: string;
  readonly key_prefix: string;
  readonly is_active: boolean;
  readonly created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { tenant, loading: tenantLoading } = useTenant();
  const [apiKeys, setApiKeys] = useState<readonly ApiKeyData[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const apiKeySectionRef = useRef<HTMLDivElement>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.keys ?? []);
      }
    } catch {
      // Keys fetch may fail if tenant doesn't exist yet
    }
  }, []);

  useEffect(() => {
    if (tenant) {
      fetchKeys();
    }
  }, [tenant, fetchKeys]);

  async function generateKey() {
    setGeneratingKey(true);
    setKeyError(null);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Default" }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          setKeyError("Please complete business setup first. Click \"Set up your business\" above.");
        } else {
          setKeyError(data.error ?? "Failed to generate API key. Please try again.");
        }
        setGeneratingKey(false);
        return;
      }

      if (data.key) {
        setNewKey(data.key);
        await fetchKeys();
      }
    } catch {
      setKeyError("Network error. Please check your connection and try again.");
    }
    setGeneratingKey(false);
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function scrollToApiKeys() {
    apiKeySectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const hasBusinessSetup = !!tenant?.name;

  // Show operational dashboard when business is set up
  if (hasBusinessSetup) {
    return <OperationalDashboard tenantName={tenant?.name ?? "NowShow"} />;
  }

  const planStatus = tenant?.plan_status ?? "trialing";
  const trialEnds = tenant?.trial_ends_at
    ? new Date(tenant.trial_ends_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const hasApiKey = apiKeys.length > 0;

  const checklist = [
    {
      title: "Create your account",
      description: "Sign up and verify your email",
      done: true,
      action: null,
      actionLabel: null,
    },
    {
      title: "Set up your business",
      description: "Add your business name and industry",
      done: hasBusinessSetup,
      action: () => router.push("/onboarding"),
      actionLabel: "Set up now",
    },
    {
      title: "Generate an API key",
      description: "Get your API key to connect your scheduling system",
      done: hasApiKey,
      action: hasBusinessSetup ? scrollToApiKeys : () => router.push("/onboarding"),
      actionLabel: hasBusinessSetup ? "Generate key" : "Set up business first",
    },
    {
      title: "Read the API docs",
      description: "Learn how to integrate NowShow with your software",
      done: false,
      action: () => router.push("/docs"),
      actionLabel: "View docs",
    },
    {
      title: "Send your first reminder",
      description: "Configure and test an appointment reminder via the API",
      done: false,
      action: () => router.push("/docs"),
      actionLabel: "See how",
    },
  ];

  const completedSteps = checklist.filter((item) => item.done).length;
  const progressPercent = Math.round((completedSteps / checklist.length) * 100);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome to {tenant?.name ?? "NowShow"}
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
          {tenant?.plan?.toUpperCase() ?? "GROWTH"} — {planStatus.replace("_", " ").toUpperCase()}
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
              Add your payment details to continue using NowShow after the trial.
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => router.push("/billing")}
          >
            Upgrade
          </Button>
        </div>
      )}

      {/* Getting Started Checklist */}
      <div className="mt-8 rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Getting Started</h2>
            <p className="mt-1 text-sm text-gray-500">
              Complete these steps to start eliminating no-shows.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500">
              {completedSteps}/{checklist.length}
            </span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {checklist.map((item, index) => (
            <div
              key={item.title}
              className={cn(
                "flex items-center gap-4 rounded-xl border px-4 py-3 transition-all",
                item.done
                  ? "border-green-100 bg-green-50/50"
                  : "border-black/[0.04] bg-white hover:border-blue-200 hover:bg-blue-50/30",
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
                  item.done
                    ? "bg-green-100 text-green-600"
                    : "border-2 border-gray-200 text-gray-300",
                )}
              >
                {item.done ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-bold">{index + 1}</span>
                )}
              </div>
              <div className="flex-1">
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
              {!item.done && item.action && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={item.action}
                  className="rounded-lg text-xs font-medium text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  {item.actionLabel}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* API Key Section */}
      <div ref={apiKeySectionRef} className="mt-8 rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">API Keys</h2>
            <p className="mt-1 text-sm text-gray-500">
              Use your API key to authenticate requests to the NowShow API.
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

        {/* Error message */}
        {keyError && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">{keyError}</p>
            </div>
          </div>
        )}

        {/* Newly generated key */}
        {newKey && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-medium text-amber-700">
                Copy this key now — it won&apos;t be shown again
              </p>
            </div>
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

        {/* How to use hint */}
        {hasApiKey && !newKey && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">How to use your API key</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Include your key in the <code className="bg-blue-100 px-1 rounded text-blue-700">X-API-Key</code> header
                of every request.{" "}
                <button
                  onClick={() => router.push("/docs")}
                  className="underline font-medium hover:text-blue-800"
                >
                  View full documentation →
                </button>
              </p>
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
            <p className="mt-2 text-sm font-medium text-gray-600">No API keys yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Generate a key to start integrating with your scheduling system.
            </p>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          onClick={() => router.push("/docs")}
          className="flex items-center gap-4 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-200 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <BookOpen className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">API Documentation</p>
            <p className="text-xs text-gray-500">Endpoints, auth, examples</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300" />
        </button>
        <button
          onClick={() => router.push("/docs#quick-start")}
          className="flex items-center gap-4 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-200 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
            <Plug className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Quick Start Guide</p>
            <p className="text-xs text-gray-500">Connect in 15 minutes</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300" />
        </button>
        <a
          href="mailto:support@nowshow.com"
          className="flex items-center gap-4 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-200"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
            <Bell className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Get Support</p>
            <p className="text-xs text-gray-500">We respond within 2 hours</p>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300" />
        </a>
      </div>
    </div>
  );
}
