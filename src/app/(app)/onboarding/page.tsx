"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Sparkles,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRICING_PLANS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/hooks/use-tenant";
import { cn } from "@/lib/utils";

const INDUSTRIES = [
  "Healthcare",
  "Dental",
  "Salon & Spa",
  "Auto Service",
  "Fitness",
  "Professional Services",
  "Veterinary",
  "Other",
];

const SIZES = [
  "Solo (1 person)",
  "Small (2-10)",
  "Medium (11-50)",
  "Large (50+)",
];

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const { tenant } = useTenant();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");

  // Step 2 state
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

  // If tenant already exists, pre-fill and start at step 2
  useEffect(() => {
    if (tenant) {
      setBusinessName(tenant.name);
      setIndustry(tenant.industry ?? "");
      setSize(tenant.business_size ?? "");
      setStep(2);
    }
  }, [tenant]);

  async function handleStep1() {
    if (!businessName.trim()) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 63);

    const { error: dbError } = await supabase.from("tenants").upsert(
      {
        auth_user_id: user.id,
        name: businessName,
        slug,
        industry: industry || null,
        business_size: size || null,
        plan: "growth",
        plan_status: "trialing",
      },
      { onConflict: "auth_user_id" },
    );

    if (dbError) {
      setError("Failed to save your business info. Please try again.");
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep(2);
  }

  async function handleStep2() {
    if (selectedPlan === "enterprise") {
      location.assign("mailto:sales@nowshow.com?subject=Enterprise%20Inquiry");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedPlan, interval: billingInterval }),
      });

      const data = await response.json();

      if (data.url) {
        location.assign(data.url);
        return;
      }

      // If Stripe returned an error or no URL, skip to step 3
      await generateApiKeyAndGoToStep3();
    } catch {
      // If Stripe is not configured, skip to step 3
      await generateApiKeyAndGoToStep3();
    }
  }

  async function generateApiKeyAndGoToStep3() {
    setError(null);

    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Default" }),
      });
      const data = await response.json();
      if (data.key) {
        setApiKey(data.key);
      }
    } catch {
      // Non-fatal — user can generate key later from dashboard
    }

    setLoading(false);
    setStep(3);
  }

  async function handleSkipToStep3() {
    setLoading(true);
    await generateApiKeyAndGoToStep3();
  }

  async function copyApiKey() {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const STEP_LABELS = [
    "Business Info",
    "Choose Plan",
    "You're Ready!",
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Progress */}
      <div className="mb-8 flex items-center justify-center gap-3">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all",
                  step >= s
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25"
                    : "bg-gray-100 text-gray-400",
                )}
              >
                {step > s ? <Check className="h-5 w-5" /> : s}
              </div>
              <span className={cn("text-[10px] font-medium", step >= s ? "text-blue-600" : "text-gray-400")}>
                {STEP_LABELS[s - 1]}
              </span>
            </div>
            {s < 3 && (
              <div
                className={cn(
                  "h-0.5 w-12 mb-4 transition-all",
                  step > s ? "bg-blue-600" : "bg-gray-200",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: Business Info */}
      {step === 1 && (
        <div className="rounded-2xl border border-black/[0.04] bg-white p-8 shadow-xl shadow-black/[0.03]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tell us about your business</h1>
              <p className="text-sm text-gray-500">This helps us customize your experience.</p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <Label htmlFor="business-name">Business name *</Label>
              <Input
                id="business-name"
                placeholder="e.g., Bright Smile Dental"
                className="mt-1 rounded-xl"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">
                This will be shown in your dashboard and reminders.
              </p>
            </div>

            <div>
              <Label>Industry <span className="text-gray-400 font-normal">(optional)</span></Label>
              <p className="text-xs text-gray-400 mt-0.5">
                Helps us tailor AI settings for your business type.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    onClick={() => setIndustry(industry === ind ? "" : ind)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                      industry === ind
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300",
                    )}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Team size <span className="text-gray-400 font-normal">(optional)</span></Label>
              <p className="text-xs text-gray-400 mt-0.5">
                Helps us recommend the right plan.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(size === s ? "" : s)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                      size === s
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button
              onClick={handleStep1}
              disabled={!businessName.trim() || loading}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 text-white shadow-lg shadow-blue-600/25"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Choose Plan */}
      {step === 2 && (
        <div className="rounded-2xl border border-black/[0.04] bg-white p-8 shadow-xl shadow-black/[0.03]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
              <CreditCard className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Choose your plan</h1>
              <p className="text-sm text-gray-500">
                All plans include a 14-day free trial. You won&apos;t be charged today.
              </p>
            </div>
          </div>

          {/* Billing toggle */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => setBillingInterval("monthly")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                billingInterval === "monthly"
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval("annual")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all",
                billingInterval === "annual"
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              Annual <span className="text-green-500 font-bold">-20%</span>
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {PRICING_PLANS.map((plan) => {
              const price =
                billingInterval === "annual" ? plan.annualPrice : plan.monthlyPrice;
              const isSelected = selectedPlan === plan.tier;

              return (
                <button
                  key={plan.tier}
                  onClick={() => setSelectedPlan(plan.tier)}
                  className={cn(
                    "w-full rounded-xl border p-5 text-left transition-all",
                    isSelected
                      ? "border-blue-300 bg-blue-50 ring-2 ring-blue-200"
                      : "border-gray-200 hover:border-gray-300",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{plan.name}</span>
                        {plan.highlighted && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{plan.description}</p>
                    </div>
                    <div className="text-right">
                      {plan.tier === "enterprise" ? (
                        <span className="text-lg font-bold text-gray-900">Custom</span>
                      ) : (
                        <>
                          <span className="text-lg font-bold text-gray-900">${price}</span>
                          <span className="text-sm text-gray-500">/mo</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              className="text-gray-500"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSkipToStep3}
                className="rounded-xl"
                disabled={loading}
              >
                Skip for now
              </Button>
              <Button
                onClick={handleStep2}
                disabled={loading}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 text-white shadow-lg shadow-blue-600/25"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {selectedPlan === "enterprise" ? "Contact Sales" : "Start Free Trial"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Welcome + API Key */}
      {step === 3 && (
        <div className="rounded-2xl border border-black/[0.04] bg-white p-8 text-center shadow-xl shadow-black/[0.03]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/25">
            <Sparkles className="h-8 w-8 text-white" />
          </div>

          <h1 className="mt-6 text-2xl font-bold text-gray-900">
            You&apos;re all set!
          </h1>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            Your NowShow account is ready. {apiKey ? "Here's your API key to get started — or head to the dashboard where everything is waiting for you." : "Head to your dashboard to generate an API key and start integrating."}
          </p>

          {apiKey && (
            <div className="mx-auto mt-8 max-w-md">
              <Label className="text-left block text-sm font-medium text-gray-700">Your API Key</Label>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded-xl border border-black/[0.06] bg-gray-50 px-4 py-3 text-left text-sm font-mono text-gray-700 break-all">
                  {apiKey}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyApiKey}
                  className="h-12 w-12 rounded-xl flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-2 text-xs text-amber-600 text-left flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Save this key now — it won&apos;t be shown again.
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 text-white shadow-lg shadow-blue-600/25"
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <button
              onClick={() => router.push("/docs")}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Read the API documentation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
