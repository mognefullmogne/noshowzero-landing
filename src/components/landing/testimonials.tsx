// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { Star } from "lucide-react";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { TESTIMONIALS } from "@/lib/constants";

export function Testimonials() {
  return (
    <SectionWrapper className="bg-slate-50/60">
      <div className="text-center">
        <ScrollReveal>
          <p className="text-sm font-semibold text-teal-600 uppercase tracking-wider">Testimonianze</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Amato dalle Attività di Tutta Italia
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            Scopri cosa dicono i nostri clienti sull&apos;eliminazione dei no-show.
          </p>
        </ScrollReveal>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t, index) => (
          <ScrollReveal key={t.name} delay={index * 0.1}>
            <div className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-900/[0.03] transition-all hover:shadow-xl card-glow">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm text-slate-600 leading-relaxed">
                &ldquo;{t.content}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-cyan-500 text-sm font-bold text-white">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.role}</p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </SectionWrapper>
  );
}
