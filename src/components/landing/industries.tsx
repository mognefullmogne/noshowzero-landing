"use client";

import {
  Stethoscope,
  SmilePlus,
  Scissors,
  Car,
  Dumbbell,
  Briefcase,
} from "lucide-react";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { INDUSTRIES } from "@/lib/constants";

const iconMap = {
  Stethoscope,
  SmilePlus,
  Scissors,
  Car,
  Dumbbell,
  Briefcase,
} as const;

export function Industries() {
  return (
    <SectionWrapper className="bg-slate-50/60">
      <div className="text-center">
        <ScrollReveal>
          <p className="text-sm font-semibold text-teal-600 uppercase tracking-wider">Settori</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Pensato per Ogni Settore
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            Se la tua attività funziona su appuntamento, NoShowZero fa per te.
          </p>
        </ScrollReveal>
      </div>

      <div className="mt-12 flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible">
        {INDUSTRIES.map((industry, index) => {
          const Icon = iconMap[industry.icon as keyof typeof iconMap];
          return (
            <ScrollReveal key={industry.name} delay={index * 0.08}>
              <div className="group flex min-w-[160px] snap-center flex-col items-center rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-md shadow-slate-900/[0.02] transition-all hover:border-teal-200/60 hover:shadow-lg card-glow">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition-all group-hover:scale-110 group-hover:bg-teal-100">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">{industry.name}</h3>
                <p className="mt-1 text-xs text-slate-400">{industry.description}</p>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
