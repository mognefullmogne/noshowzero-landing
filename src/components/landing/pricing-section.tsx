// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { PRICING_PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <SectionWrapper id="pricing">
      <div className="text-center">
        <ScrollReveal>
          <p className="text-sm font-semibold text-teal-600 uppercase tracking-wider">Prezzi</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Prezzi Semplici e Trasparenti
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            Inizia gratis per 14 giorni. Nessuna carta di credito. Passa al piano a pagamento quando vuoi.
          </p>
        </ScrollReveal>

        {/* Toggle */}
        <ScrollReveal delay={0.1}>
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all",
                !annual
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Mensile
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all",
                annual
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Annuale
              <span className="ml-1.5 text-xs font-bold text-teal-600">Risparmi il 20%</span>
            </button>
          </div>
        </ScrollReveal>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PRICING_PLANS.map((plan, index) => {
          const price = annual ? plan.annualPrice : plan.monthlyPrice;
          return (
            <ScrollReveal key={plan.tier} delay={index * 0.1}>
              <div
                className={cn(
                  "relative flex h-full flex-col overflow-hidden rounded-2xl border p-8 transition-all",
                  plan.highlighted
                    ? "border-teal-200 bg-white shadow-2xl shadow-teal-600/[0.08] ring-1 ring-teal-100"
                    : "border-slate-100 bg-white shadow-lg shadow-slate-900/[0.03] hover:shadow-xl card-glow",
                )}
              >
                {plan.highlighted && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-600 to-cyan-500" />
                )}

                {plan.highlighted && (
                  <span className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
                    <Sparkles className="h-3 w-3" />
                    Più Popolare
                  </span>
                )}

                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>

                <div className="mt-6">
                  <span className="text-4xl font-extrabold text-slate-900">
                    €{annual ? Math.round(price / 12).toLocaleString("it-IT") : price.toLocaleString("it-IT")}
                  </span>
                  <span className="text-slate-500">/mese</span>
                  {annual && (
                    <p className="mt-1 text-xs text-slate-400">€{price.toLocaleString("it-IT")}/anno</p>
                  )}
                </div>

                <Button
                  asChild
                  className={cn(
                    "mt-6 w-full rounded-xl text-sm font-semibold",
                    plan.highlighted
                      ? "bg-gradient-to-r from-teal-600 to-cyan-500 text-white shadow-lg shadow-teal-600/25 hover:shadow-xl hover:brightness-110"
                      : "",
                  )}
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  <Link href={`/signup?plan=${plan.tier}&interval=${annual ? "annual" : "monthly"}`}>
                    {plan.cta}
                  </Link>
                </Button>

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-500" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
