"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-32 pb-20 sm:px-6 lg:px-8 lg:pt-40 lg:pb-28">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-100/60 to-indigo-100/40 blur-3xl" />
        <div className="absolute top-40 right-0 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-purple-100/30 to-pink-100/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
              </span>
              AI-Powered Appointment Management
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="mt-8 text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Stop Losing Revenue to{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              No-Shows
            </span>
          </motion.h1>

          {/* Sub-text */}
          <motion.p
            className="mt-6 text-lg text-gray-600 sm:text-xl leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Smart reminders, AI-powered waitlists, and automatic slot filling.
            Reduce no-shows by up to 80% and recover thousands in lost revenue —
            for any appointment-based business.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Button
              size="lg"
              asChild
              className="h-13 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30"
            >
              <Link href="/signup">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-13 rounded-xl px-8 text-base font-semibold"
            >
              <Link href="/#how-it-works">
                <Play className="mr-2 h-4 w-4" />
                See How It Works
              </Link>
            </Button>
          </motion.div>

          {/* Social proof mini */}
          <motion.p
            className="mt-8 text-sm text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            14-day free trial &middot; No credit card required &middot; Setup in 15 minutes
          </motion.p>
        </div>

        {/* Dashboard mockup */}
        <motion.div
          className="relative mx-auto mt-16 max-w-5xl"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <div className="rounded-2xl border border-black/[0.08] bg-white p-2 shadow-2xl shadow-black/[0.08]">
            <div className="aspect-[16/9] overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100">
              {/* Mock dashboard UI */}
              <div className="flex h-full flex-col">
                {/* Top bar */}
                <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-yellow-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                  </div>
                  <div className="ml-4 h-5 w-64 rounded bg-gray-200" />
                </div>
                {/* Content */}
                <div className="flex flex-1">
                  {/* Sidebar */}
                  <div className="hidden w-56 border-r border-gray-200 p-4 sm:block">
                    <div className="space-y-3">
                      <div className="h-8 w-full rounded-lg bg-blue-100" />
                      <div className="h-8 w-full rounded-lg bg-gray-100" />
                      <div className="h-8 w-full rounded-lg bg-gray-100" />
                      <div className="h-8 w-full rounded-lg bg-gray-100" />
                      <div className="h-8 w-full rounded-lg bg-gray-100" />
                    </div>
                  </div>
                  {/* Main area */}
                  <div className="flex-1 p-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                        <div className="h-3 w-20 rounded bg-gray-200" />
                        <div className="mt-2 h-7 w-16 rounded bg-blue-200" />
                        <div className="mt-1 h-2 w-24 rounded bg-green-200" />
                      </div>
                      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                        <div className="h-3 w-24 rounded bg-gray-200" />
                        <div className="mt-2 h-7 w-12 rounded bg-indigo-200" />
                        <div className="mt-1 h-2 w-20 rounded bg-green-200" />
                      </div>
                      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                        <div className="h-3 w-16 rounded bg-gray-200" />
                        <div className="mt-2 h-7 w-20 rounded bg-purple-200" />
                        <div className="mt-1 h-2 w-16 rounded bg-yellow-200" />
                      </div>
                    </div>
                    <div className="mt-6 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                      <div className="h-3 w-32 rounded bg-gray-200 mb-4" />
                      <div className="space-y-2">
                        <div className="h-8 w-full rounded bg-gray-50" />
                        <div className="h-8 w-full rounded bg-blue-50" />
                        <div className="h-8 w-full rounded bg-gray-50" />
                        <div className="h-8 w-full rounded bg-gray-50" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Glow effect */}
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-purple-600/10 blur-2xl" />
        </motion.div>
      </div>
    </section>
  );
}
