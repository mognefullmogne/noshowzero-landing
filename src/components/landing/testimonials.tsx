"use client";

import { Star } from "lucide-react";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { TESTIMONIALS } from "@/lib/constants";

export function Testimonials() {
  return (
    <SectionWrapper className="bg-gray-50/50">
      <div className="text-center">
        <ScrollReveal>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Loved by Businesses Everywhere
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            See what our customers have to say about eliminating no-shows.
          </p>
        </ScrollReveal>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t, index) => (
          <ScrollReveal key={t.name} delay={index * 0.1}>
            <div className="flex h-full flex-col rounded-2xl border border-black/[0.04] bg-white p-8 shadow-xl shadow-black/[0.03]">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm text-gray-600 leading-relaxed">
                &ldquo;{t.content}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-black/[0.04] pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </SectionWrapper>
  );
}
