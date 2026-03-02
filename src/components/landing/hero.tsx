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
          {/* Floating AI notification - top right */}
          <motion.div
            className="absolute -top-4 -right-3 z-20 hidden sm:flex items-center gap-2 rounded-xl border border-green-200 bg-white px-3 py-2 shadow-lg shadow-green-600/10"
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
              <svg className="h-3.5 w-3.5 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-900">Slot auto-filled by AI</p>
              <p className="text-[10px] text-gray-400">Waitlist match: 94% score</p>
            </div>
          </motion.div>

          {/* Floating AI notification - bottom left */}
          <motion.div
            className="absolute -bottom-3 -left-3 z-20 hidden sm:flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 shadow-lg shadow-blue-600/10"
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 1.6 }}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-3.5 w-3.5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-900">AI reminder sent</p>
              <p className="text-[10px] text-gray-400">Emily Davis — tomorrow 10:00 AM</p>
            </div>
          </motion.div>
          <div className="animate-float rounded-2xl border border-black/[0.08] bg-white p-1.5 shadow-2xl shadow-black/[0.08]">
            <div className="overflow-hidden rounded-xl bg-white">
              {/* Mock dashboard UI */}
              <div className="flex h-[420px] sm:h-[480px] flex-col text-[10px] sm:text-xs select-none">
                {/* Top bar */}
                <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50/80 px-4 py-2">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                  </div>
                  <div className="ml-3 flex h-5 flex-1 items-center justify-center rounded-md bg-white border border-gray-200">
                    <span className="text-[9px] text-gray-400">app.nowshow.com/calendar</span>
                  </div>
                </div>
                {/* Content */}
                <div className="flex flex-1 min-h-0">
                  {/* Sidebar */}
                  <div className="hidden w-40 shrink-0 border-r border-gray-100 bg-gray-50/50 px-2 py-3 sm:block">
                    {/* Logo */}
                    <div className="flex items-center gap-1.5 px-2 mb-4">
                      <div className="h-5 w-5 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                      </div>
                      <span className="font-bold text-[11px] text-gray-900">NowShow</span>
                    </div>
                    {/* Nav items */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-gray-500">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                        <span>Dashboard</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-2 py-1.5 font-semibold text-blue-700">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        <span>Calendar</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-gray-500">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                        <span>Appointments</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-gray-500">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                        <span>Waitlist</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-gray-500">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        <span>Messages</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="px-2 mb-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-gray-500">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
                          <span>Analytics</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-gray-500">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.2.65.77 1.1 1.45 1.1H21a2 2 0 010 4h-.09c-.68 0-1.25.45-1.45 1.1z"/></svg>
                          <span>Settings</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-gray-500">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                          <span>AI Chat</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main area */}
                  <div className="flex-1 min-w-0 flex flex-col bg-white">
                    {/* Header */}
                    <div className="px-4 pt-3 pb-2 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-gray-900">Slot Calendar</p>
                          <p className="text-[9px] text-gray-400">View and manage weekly slots</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1">
                            <span className="text-gray-600">Downtown Clinic</span>
                            <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-600">
                            <span>Mar 3</span>
                            <span className="text-gray-300">—</span>
                            <span>Mar 9, 2026</span>
                          </div>
                        </div>
                      </div>
                      {/* Stats bar */}
                      <div className="mt-2 flex items-center gap-4 text-[9px]">
                        <span className="font-semibold text-gray-700">21 slots</span>
                        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />3 free</span>
                        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />16 booked</span>
                        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />2 at risk</span>
                      </div>
                    </div>

                    {/* Calendar grid */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <div className="grid grid-cols-3 sm:grid-cols-6 h-full">
                        {/* Monday */}
                        <div className="border-r border-gray-100 flex flex-col">
                          <div className="px-1.5 py-1.5 text-center border-b border-gray-100 bg-gray-50/50">
                            <p className="font-semibold text-gray-900">MON 3</p>
                          </div>
                          <div className="flex-1 p-1 space-y-1 overflow-hidden">
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">9:00–9:30</p>
                              <p className="text-gray-500 truncate">General Checkup</p>
                              <p className="text-gray-400 truncate">Dr. Sarah Chen</p>
                              <p className="font-medium text-gray-600 truncate">James Wilson</p>
                            </div>
                            <div className="rounded-md border-l-2 border-amber-400 bg-amber-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">10:00–10:45</p>
                              <p className="text-gray-500 truncate">Dermatology</p>
                              <p className="text-gray-400 truncate">Dr. Marco Rossi</p>
                              <p className="font-medium text-gray-600 truncate">Emily Davis</p>
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-1 text-[8px] font-bold text-amber-700 mt-0.5">AI: 72% risk</span>
                            </div>
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">11:00–11:30</p>
                              <p className="text-gray-500 truncate">Orthopedics</p>
                              <p className="text-gray-400 truncate">Dr. Lisa Park</p>
                              <p className="font-medium text-gray-600 truncate">Tom Martinez</p>
                            </div>
                            <div className="rounded-md border-l-2 border-blue-400 bg-blue-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">14:00–14:30</p>
                              <p className="text-blue-500 italic">Open slot</p>
                            </div>
                          </div>
                        </div>

                        {/* Tuesday */}
                        <div className="border-r border-gray-100 flex flex-col">
                          <div className="px-1.5 py-1.5 text-center border-b border-gray-100 bg-gray-50/50">
                            <p className="font-semibold text-gray-900">TUE 4</p>
                          </div>
                          <div className="flex-1 p-1 space-y-1 overflow-hidden">
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">9:00–9:45</p>
                              <p className="text-gray-500 truncate">Cardiology</p>
                              <p className="text-gray-400 truncate">Dr. Sarah Chen</p>
                              <p className="font-medium text-gray-600 truncate">Anna Lopez</p>
                            </div>
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">10:00–10:30</p>
                              <p className="text-gray-500 truncate">Neurology</p>
                              <p className="text-gray-400 truncate">Dr. Lisa Park</p>
                              <p className="font-medium text-gray-600 truncate">David Kim</p>
                            </div>
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">11:00–12:00</p>
                              <p className="text-gray-500 truncate">Physical Therapy</p>
                              <p className="text-gray-400 truncate">Dr. Marco Rossi</p>
                              <p className="font-medium text-gray-600 truncate">Rachel Green</p>
                            </div>
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">14:00–14:30</p>
                              <p className="text-gray-500 truncate">Follow-up</p>
                              <p className="text-gray-400 truncate">Dr. Sarah Chen</p>
                              <p className="font-medium text-gray-600 truncate">Mike Johnson</p>
                            </div>
                          </div>
                        </div>

                        {/* Wednesday */}
                        <div className="border-r border-gray-100 flex flex-col">
                          <div className="px-1.5 py-1.5 text-center border-b border-gray-100 bg-gray-50/50">
                            <p className="font-semibold text-gray-900">WED 5</p>
                          </div>
                          <div className="flex-1 p-1 space-y-1 overflow-hidden">
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">9:00–9:30</p>
                              <p className="text-gray-500 truncate">Eye Exam</p>
                              <p className="text-gray-400 truncate">Dr. Lisa Park</p>
                              <p className="font-medium text-gray-600 truncate">Chris Taylor</p>
                            </div>
                            <div className="rounded-md border-l-2 border-amber-400 bg-amber-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">10:00–10:45</p>
                              <p className="text-gray-500 truncate">Dental Cleaning</p>
                              <p className="text-gray-400 truncate">Dr. Marco Rossi</p>
                              <p className="font-medium text-gray-600 truncate">Sarah Brown</p>
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-1 text-[8px] font-bold text-amber-700 mt-0.5">AI: 65% risk</span>
                            </div>
                            <div className="rounded-md border-l-2 border-blue-400 bg-blue-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">12:00–12:30</p>
                              <p className="text-blue-500 italic">Open slot</p>
                            </div>
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">14:00–15:00</p>
                              <p className="text-gray-500 truncate">Consultation</p>
                              <p className="text-gray-400 truncate">Dr. Sarah Chen</p>
                              <p className="font-medium text-gray-600 truncate">Laura White</p>
                            </div>
                          </div>
                        </div>

                        {/* Thursday - hidden on mobile */}
                        <div className="border-r border-gray-100 hidden sm:flex flex-col">
                          <div className="px-1.5 py-1.5 text-center border-b border-gray-100 bg-gray-50/50">
                            <p className="font-semibold text-gray-900">THU 6</p>
                          </div>
                          <div className="flex-1 p-1 space-y-1 overflow-hidden">
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">9:00–9:45</p>
                              <p className="text-gray-500 truncate">Pediatrics</p>
                              <p className="text-gray-400 truncate">Dr. Lisa Park</p>
                              <p className="font-medium text-gray-600 truncate">Mia Rodriguez</p>
                            </div>
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">10:00–10:30</p>
                              <p className="text-gray-500 truncate">Allergy Test</p>
                              <p className="text-gray-400 truncate">Dr. Marco Rossi</p>
                              <p className="font-medium text-gray-600 truncate">Jake Thomas</p>
                            </div>
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">11:00–11:30</p>
                              <p className="text-gray-500 truncate">Dermatology</p>
                              <p className="text-gray-400 truncate">Dr. Sarah Chen</p>
                              <p className="font-medium text-gray-600 truncate">Olivia Scott</p>
                            </div>
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">13:00–13:30</p>
                              <p className="text-gray-500 truncate">Follow-up</p>
                              <p className="text-gray-400 truncate">Dr. Lisa Park</p>
                              <p className="font-medium text-gray-600 truncate">Ben Clark</p>
                            </div>
                          </div>
                        </div>

                        {/* Friday - hidden on mobile */}
                        <div className="border-r border-gray-100 hidden sm:flex flex-col">
                          <div className="px-1.5 py-1.5 text-center border-b border-gray-100 bg-gray-50/50">
                            <p className="font-semibold text-gray-900">FRI 7</p>
                          </div>
                          <div className="flex-1 p-1 space-y-1 overflow-hidden">
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">9:00–9:30</p>
                              <p className="text-gray-500 truncate">General Checkup</p>
                              <p className="text-gray-400 truncate">Dr. Sarah Chen</p>
                              <p className="font-medium text-gray-600 truncate">Noah Harris</p>
                            </div>
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">10:00–10:45</p>
                              <p className="text-gray-500 truncate">Cardiology</p>
                              <p className="text-gray-400 truncate">Dr. Marco Rossi</p>
                              <p className="font-medium text-gray-600 truncate">Sophia Lee</p>
                            </div>
                            <div className="rounded-md border-l-2 border-blue-400 bg-blue-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">11:30–12:00</p>
                              <p className="text-blue-500 italic">Open slot</p>
                            </div>
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">14:00–14:30</p>
                              <p className="text-gray-500 truncate">Orthopedics</p>
                              <p className="text-gray-400 truncate">Dr. Lisa Park</p>
                              <p className="font-medium text-gray-600 truncate">Ethan Moore</p>
                            </div>
                          </div>
                        </div>

                        {/* Saturday - hidden on mobile */}
                        <div className="hidden sm:flex flex-col">
                          <div className="px-1.5 py-1.5 text-center border-b border-gray-100 bg-gray-50/50">
                            <p className="font-semibold text-gray-900">SAT 8</p>
                          </div>
                          <div className="flex-1 p-1 space-y-1 overflow-hidden">
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">9:00–9:30</p>
                              <p className="text-gray-500 truncate">Eye Exam</p>
                              <p className="text-gray-400 truncate">Dr. Sarah Chen</p>
                              <p className="font-medium text-gray-600 truncate">Grace Allen</p>
                            </div>
                            <div className="rounded-md border-l-2 border-emerald-400 bg-emerald-50 px-1.5 py-1">
                              <p className="font-semibold text-gray-700">10:00–10:30</p>
                              <p className="text-gray-500 truncate">Dental Cleaning</p>
                              <p className="text-gray-400 truncate">Dr. Marco Rossi</p>
                              <p className="font-medium text-gray-600 truncate">Liam Walker</p>
                            </div>
                          </div>
                        </div>
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
