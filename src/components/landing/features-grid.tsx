"use client";

import {
  Bell,
  ListChecks,
  CalendarDays,
  LayoutDashboard,
  MapPin,
  Code,
} from "lucide-react";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FEATURES } from "@/lib/constants";

const iconMap = {
  Bell,
  ListChecks,
  CalendarDays,
  LayoutDashboard,
  MapPin,
  Code,
} as const;

export function FeaturesGrid() {
  return (
    <SectionWrapper id="features">
      <div className="text-center">
        <ScrollReveal>
          <p className="text-sm font-semibold text-teal-600 uppercase tracking-wider">Features</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Everything You Need to{" "}
            <span className="text-gradient-teal">Eliminate No-Shows</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            A complete toolkit for appointment-based businesses — from solo practitioners to
            multi-location enterprises.
          </p>
        </ScrollReveal>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => {
          const Icon = iconMap[feature.icon as keyof typeof iconMap];
          return (
            <ScrollReveal key={feature.title} delay={index * 0.1}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-900/[0.03] transition-all hover:border-teal-200/60 card-glow">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-100">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  {feature.description}
                </p>
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-teal-500 to-cyan-400 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
