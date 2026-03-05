// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

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
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Il Problema dei No-Show è{" "}
            <span className="text-rose-500">Enorme</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            Ogni appuntamento saltato ti costa denaro, spreca il tempo del tuo team e impedisce
            ad altri clienti di ricevere assistenza.
          </p>
        </ScrollReveal>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {STATS.map((stat, index) => (
          <ScrollReveal key={stat.label} delay={index * 0.15}>
            <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-lg shadow-slate-900/[0.03] transition-all hover:shadow-xl card-glow">
              <div className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
                <AnimatedCounter
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                />
              </div>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed">{stat.label}</p>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-rose-500 to-orange-400 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </ScrollReveal>
        ))}
      </div>
    </SectionWrapper>
  );
}
