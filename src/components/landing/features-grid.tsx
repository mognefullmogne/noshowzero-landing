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
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Eliminate No-Shows
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            A complete toolkit for appointment-based businesses — from solo practitioners to
            multi-location enterprises.
          </p>
        </ScrollReveal>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => {
          const Icon = iconMap[feature.icon as keyof typeof iconMap];
          return (
            <ScrollReveal key={feature.title} delay={index * 0.1}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-black/[0.04] bg-white p-8 shadow-xl shadow-black/[0.03] transition-all hover:border-blue-100 hover:shadow-2xl hover:shadow-blue-600/[0.06]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
