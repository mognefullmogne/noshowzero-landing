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
    <section className="border-y border-black/[0.04] bg-gray-50/50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-wider">
          Trusted by 500+ appointment-based businesses
        </p>
        <div className="relative mt-8 overflow-hidden">
          {/* Fade edges */}
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-gray-50/80 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-gray-50/80 to-transparent" />

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
                <span className="whitespace-nowrap text-lg font-semibold text-gray-300 select-none">
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
