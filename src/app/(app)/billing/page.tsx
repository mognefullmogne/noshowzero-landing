// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, ExternalLink, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/hooks/use-tenant";
import { PRICING_PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function BillingPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const router = useRouter();

  const currentPlan = PRICING_PLANS.find((p) => p.tier === (tenant?.plan ?? "growth"));
  const planStatus = tenant?.plan_status ?? "trialing";

  async function openPortal() {
    setLoadingPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        router.push(data.url);
        return;
      }
    } catch {
      // Portal may fail if no Stripe customer
    }
    setLoadingPortal(false);
  }

  async function startCheckout(tier: string) {
    setLoadingCheckout(tier);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval: "monthly" }),
      });
      const data = await res.json();
      if (data.url) {
        router.push(data.url);
        return;
      }
    } catch {
      // Checkout may fail
    }
    setLoadingCheckout(null);
  }

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const trialEnds = tenant?.trial_ends_at
    ? new Date(tenant.trial_ends_at).toLocaleDateString("it-IT", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Fatturazione</h1>
      <p className="mt-1 text-sm text-gray-500">Gestisci il tuo abbonamento e i dettagli di pagamento.</p>

      {/* Current Plan */}
      <div className="mt-8 rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Piano Attuale</h2>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900">
                {currentPlan?.name ?? "Starter"}
              </span>
              <Badge
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  planStatus === "active" && "bg-green-50 text-green-700",
                  planStatus === "trialing" && "bg-blue-50 text-blue-700",
                  planStatus === "past_due" && "bg-yellow-50 text-yellow-700",
                  planStatus === "canceled" && "bg-red-50 text-red-700",
                )}
              >
                {planStatus.replace("_", " ")}
              </Badge>
            </div>
            {planStatus === "trialing" && trialEnds && (
              <p className="mt-1 text-sm text-gray-500">Il periodo di prova scade il {trialEnds}</p>
            )}
          </div>

          {tenant?.stripe_customer_id && (
            <Button
              onClick={openPortal}
              disabled={loadingPortal}
              variant="outline"
              className="rounded-xl"
            >
              {loadingPortal ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Gestisci Pagamento
              <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Plan features */}
        {currentPlan && (
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-black/[0.04] pt-6">
            <div>
              <p className="text-xs text-gray-400">Appuntamenti</p>
              <p className="text-sm font-semibold text-gray-900">
                {currentPlan.limits.appointments}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Sedi</p>
              <p className="text-sm font-semibold text-gray-900">
                {currentPlan.limits.locations}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Membri del team</p>
              <p className="text-sm font-semibold text-gray-900">
                {currentPlan.limits.users}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade options */}
      {planStatus !== "canceled" && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900">Piani Disponibili</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {PRICING_PLANS.map((plan) => {
              const isCurrent = plan.tier === (tenant?.plan ?? "growth");
              const isEnterprise = plan.tier === "enterprise";

              return (
                <div
                  key={plan.tier}
                  className={cn(
                    "rounded-2xl border p-6 transition-all",
                    isCurrent
                      ? "border-blue-200 bg-blue-50/50"
                      : "border-black/[0.04] bg-white shadow-sm",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">{plan.name}</h3>
                    {isCurrent && (
                      <Badge className="rounded-full bg-blue-100 text-blue-700 text-xs">
                        Attuale
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3">
                    {isEnterprise ? (
                      <span className="text-2xl font-bold text-gray-900">Custom</span>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-gray-900">
                          €{plan.monthlyPrice}
                        </span>
                        <span className="text-gray-500">/mese</span>
                      </>
                    )}
                  </div>

                  <ul className="mt-4 space-y-2">
                    {plan.features.slice(0, 5).map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-600" />
                        <span className="text-xs text-gray-600">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5">
                    {isCurrent ? (
                      <Button disabled variant="outline" className="w-full rounded-xl text-sm">
                        Piano Attuale
                      </Button>
                    ) : isEnterprise ? (
                      <Button
                        variant="outline"
                        className="w-full rounded-xl text-sm"
                        onClick={() =>
                          location.assign("mailto:info@noshowzero.com?subject=Enterprise%20Inquiry")
                        }
                      >
                        Contattaci
                      </Button>
                    ) : (
                      <Button
                        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm text-white"
                        onClick={() => startCheckout(plan.tier)}
                        disabled={loadingCheckout === plan.tier}
                      >
                        {loadingCheckout === plan.tier ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Passa a {plan.name}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment warning */}
      {planStatus === "past_due" && (
        <div className="mt-8 flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-900">Pagamento fallito</p>
            <p className="text-xs text-yellow-700">
              Aggiorna il metodo di pagamento per evitare interruzioni del servizio.
            </p>
          </div>
          <Button
            size="sm"
            onClick={openPortal}
            className="ml-auto rounded-lg bg-yellow-600 text-white hover:bg-yellow-700"
          >
            Aggiorna Pagamento
          </Button>
        </div>
      )}
    </div>
  );
}
