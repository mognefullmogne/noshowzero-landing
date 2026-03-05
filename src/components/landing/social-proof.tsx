// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { motion } from "framer-motion";

const logos = [
  "BrightSmile Dental",
  "UrbanFit",
  "Glow Beauty",
  "HealthFirst",
  "AutoCare Pro",
  "FitZone",
  "ClearView Optometry",
  "PetWell Vet",
];

export function SocialProof() {
  return (
    <section className="border-y border-slate-100 bg-slate-50/60 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-slate-400 uppercase tracking-wider">
          Scelto da oltre 500 attività su appuntamento
        </p>
        <div className="relative mt-8 overflow-hidden">
          {/* Fade edges */}
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-slate-50/90 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-slate-50/90 to-transparent" />

          <motion.div
            className="flex gap-12"
            animate={{ x: [0, -1200] }}
            transition={{
              x: { repeat: Infinity, repeatType: "loop", duration: 30, ease: "linear" },
            }}
          >
            {[...logos, ...logos, ...logos].map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex-shrink-0 flex items-center justify-center h-10"
              >
                <span className="whitespace-nowrap text-lg font-bold text-slate-200 select-none tracking-tight">
                  {name}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
