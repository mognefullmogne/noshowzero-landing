"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Key,
  Copy,
  Check,
  BookOpen,
  Zap,
  TrendingUp,
  Users,
  CalendarDays,
  AlertCircle,
  Loader2,
  ArrowRight,
  Building2,
  Plug,
  Bell,
  Info,
  AlertTriangle,
  Gift,
  CheckCircle,
  Clock,
  Target,
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
  const router = useRouter();
  const { tenant, loading: tenantLoading } = useTenant();
  const [apiKeys, setApiKeys] = useState<readonly ApiKeyData[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const apiKeySectionRef = useRef<HTMLDivElement>(null);
  const [analytics, setAnalytics] = useState<{
    totalAppointments: number;
    noShowRate: number;
    waitlistFills: number;
    revenueSaved: number;
    offersSent: number;
    offersAccepted: number;
    offersPending: number;
    offerFillRate: number;
    avgResponseMinutes: number | null;
  } | null>(null);
  const [recentOffers, setRecentOffers] = useState<readonly {
    id: string;
    status: string;
    smart_score: number | null;
    offered_at: string;
    responded_at: string | null;
    patient?: { first_name: string; last_name: string } | null;
    original_appointment?: { service_name: string; scheduled_at: string } | null;
  }[]>([]);

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

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setAnalytics(json.data);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchRecentOffers = useCallback(async () => {
    try {
      const res = await fetch("/api/offers?pageSize=5");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setRecentOffers(json.data ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (tenant) {
      fetchKeys();
      fetchAnalytics();
      fetchRecentOffers();
    }
  }, [tenant, fetchKeys, fetchAnalytics, fetchRecentOffers]);

  // Auto-poll analytics and offers every 30 seconds (silent, no spinner)
  useEffect(() => {
    if (!tenant) return;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAnalytics();
        fetchRecentOffers();
      }
    }, 30_000);
    return () => clearInterval(poll);
  }, [tenant, fetchAnalytics, fetchRecentOffers]);

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

  const planStatus = tenant?.plan_status ?? "trialing";
  const trialEnds = tenant?.trial_ends_at
    ? new Date(tenant.trial_ends_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const hasBusinessSetup = !!tenant?.name;
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

      {/* Stats cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Appointments",
            value: analytics ? analytics.totalAppointments.toLocaleString() : "—",
            icon: CalendarDays,
            change: analytics?.totalAppointments ? "All time" : "No data yet",
          },
          {
            label: "No-Show Rate",
            value: analytics ? `${analytics.noShowRate}%` : "—",
            icon: TrendingUp,
            change: analytics && analytics.noShowRate > 0 ? "Track reduction over time" : "No no-shows yet",
          },
          {
            label: "Waitlist Fills",
            value: analytics ? analytics.waitlistFills.toLocaleString() : "—",
            icon: Users,
            change: analytics?.waitlistFills ? "Cancellations recovered" : "No fills yet",
          },
          {
            label: "Revenue Saved",
            value: analytics ? `$${analytics.revenueSaved.toLocaleString()}` : "—",
            icon: Zap,
            change: analytics?.revenueSaved ? "From recovered appointments" : "Start tracking",
          },
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

      {/* Backfill Engine */}
      <div className="mt-8 rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Backfill Engine</h2>
              <p className="text-sm text-gray-500">Automatic waitlist slot recovery</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => router.push("/offers")}
          >
            View All Offers
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>

        {/* Engine stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-gray-500">Offers Sent</span>
            </div>
            <p className="mt-1 text-xl font-bold text-gray-900">{analytics?.offersSent ?? 0}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-medium text-gray-500">Accepted</span>
            </div>
            <p className="mt-1 text-xl font-bold text-green-700">{analytics?.offersAccepted ?? 0}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-indigo-500" />
              <span className="text-xs font-medium text-gray-500">Fill Rate</span>
            </div>
            <p className="mt-1 text-xl font-bold text-indigo-700">{analytics?.offerFillRate ?? 0}%</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium text-gray-500">Avg Response</span>
            </div>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {analytics?.avgResponseMinutes != null
                ? analytics.avgResponseMinutes < 60
                  ? `${analytics.avgResponseMinutes}m`
                  : `${Math.round(analytics.avgResponseMinutes / 60)}h`
                : "—"}
            </p>
          </div>
        </div>

        {/* Recent offers */}
        {recentOffers.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Recent Offers</p>
            <div className="space-y-2">
              {recentOffers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex items-center gap-3 rounded-xl border border-black/[0.04] px-3 py-2"
                >
                  <div className={cn(
                    "h-2 w-2 rounded-full flex-shrink-0",
                    offer.status === "pending" && "bg-amber-400",
                    offer.status === "accepted" && "bg-green-400",
                    offer.status === "declined" && "bg-orange-400",
                    offer.status === "expired" && "bg-gray-300",
                    offer.status === "cancelled" && "bg-red-400",
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {offer.patient
                        ? `${offer.patient.first_name} ${offer.patient.last_name}`
                        : "Patient"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {offer.original_appointment?.service_name ?? "Service"}{" "}
                      {offer.original_appointment?.scheduled_at
                        ? `· ${new Date(offer.original_appointment.scheduled_at).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "text-[10px] font-medium rounded-full capitalize flex-shrink-0",
                      offer.status === "pending" && "bg-amber-50 text-amber-700",
                      offer.status === "accepted" && "bg-green-50 text-green-700",
                      offer.status === "declined" && "bg-orange-50 text-orange-700",
                      offer.status === "expired" && "bg-gray-100 text-gray-500",
                      offer.status === "cancelled" && "bg-red-50 text-red-600",
                    )}
                  >
                    {offer.status}
                  </Badge>
                  {offer.smart_score != null && (
                    <span className="text-xs font-semibold text-gray-400 flex-shrink-0">
                      {offer.smart_score}/100
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {recentOffers.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 text-center">
            <Gift className="mx-auto h-6 w-6 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No offers yet</p>
            <p className="text-xs text-gray-400">When appointments are cancelled, the engine automatically finds waitlist matches.</p>
          </div>
        )}
      </div>

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
