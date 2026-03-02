"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#0a0a0a] px-4 py-24 sm:px-6 lg:px-8">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-[300px] w-[300px] rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <ScrollReveal>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Ready to Eliminate No-Shows?
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Join 500+ businesses that have reduced no-shows by up to 80%.
            Start your free 14-day trial today.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              asChild
              className="h-13 rounded-xl bg-white px-8 text-base font-semibold text-gray-900 shadow-lg transition-all hover:bg-gray-100 hover:shadow-xl"
            >
              <Link href="/signup">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-13 rounded-xl border-white/20 px-8 text-base font-semibold text-white hover:bg-white/10"
            >
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-gray-500">
            No credit card required &middot; 14-day free trial &middot; Cancel anytime
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
