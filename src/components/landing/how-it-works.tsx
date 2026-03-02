"use client";

import { CalendarSync, Bell, UserCheck } from "lucide-react";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { HOW_IT_WORKS } from "@/lib/constants";

const iconMap = {
  CalendarSync,
  Bell,
  UserCheck,
} as const;

export function HowItWorks() {
  return (
    <SectionWrapper id="how-it-works" className="bg-gray-50/50">
      <div className="text-center">
        <ScrollReveal>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Get up and running in three simple steps. No complex setup required.
          </p>
        </ScrollReveal>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
        {HOW_IT_WORKS.map((item, index) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          return (
            <ScrollReveal key={item.step} delay={index * 0.15}>
              <div className="relative flex flex-col items-center text-center">
                {/* Step number */}
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
                  <Icon className="h-7 w-7" />
                </div>

                {/* Connector line */}
                {index < HOW_IT_WORKS.length - 1 && (
                  <div className="absolute left-[calc(50%+3rem)] top-8 hidden h-0.5 w-[calc(100%-6rem)] bg-gradient-to-r from-blue-200 to-indigo-200 md:block" />
                )}

                <span className="text-sm font-bold text-blue-600">Step {item.step}</span>
                <h3 className="mt-2 text-xl font-bold text-gray-900">{item.title}</h3>
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
