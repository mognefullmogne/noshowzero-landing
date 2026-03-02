"use client";

import { STATS } from "@/lib/constants";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { SectionWrapper } from "@/components/shared/section-wrapper";

export function ProblemStats() {
  return (
    <SectionWrapper id="problem">
      <div className="text-center">
        <ScrollReveal>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            The No-Show Problem Is{" "}
            <span className="text-red-500">Massive</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Every missed appointment costs you money, wastes your team&apos;s time, and blocks
            other clients from getting care.
          </p>
        </ScrollReveal>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
        {STATS.map((stat, index) => (
          <ScrollReveal key={stat.label} delay={index * 0.15}>
            <div className="group relative overflow-hidden rounded-2xl border border-black/[0.04] bg-white p-8 text-center shadow-xl shadow-black/[0.03] transition-all hover:shadow-2xl hover:shadow-black/[0.06]">
              <div className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                <AnimatedCounter
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                />
              </div>
              <p className="mt-3 text-sm text-gray-500 leading-relaxed">{stat.label}</p>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </ScrollReveal>
        ))}
      </div>
    </SectionWrapper>
  );
}
