"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
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
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Start free for 14 days. No credit card required. Upgrade when you&apos;re ready.
          </p>
        </ScrollReveal>

        {/* Toggle */}
        <ScrollReveal delay={0.1}>
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-black/[0.06] bg-gray-50 p-1">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all",
                !annual
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all",
                annual
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              Annual
              <span className="ml-1.5 text-xs font-bold text-green-600">Save 20%</span>
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
                    ? "border-blue-200 bg-white shadow-2xl shadow-blue-600/[0.08] ring-1 ring-blue-100"
                    : "border-black/[0.04] bg-white shadow-xl shadow-black/[0.03] hover:shadow-2xl",
                )}
              >
                {plan.highlighted && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
                )}

                {plan.highlighted && (
                  <span className="mb-4 inline-flex w-fit items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    Most Popular
                  </span>
                )}

                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{plan.description}</p>

                <div className="mt-6">
                  <span className="text-4xl font-bold text-gray-900">${price}</span>
                  <span className="text-gray-500">/mo</span>
                </div>

                <Button
                  asChild
                  className={cn(
                    "mt-6 w-full rounded-xl text-sm font-semibold",
                    plan.highlighted
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 hover:shadow-xl"
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
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                      <span className="text-sm text-gray-600">{feature}</span>
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
