"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EASE_OUT_EXPO = [0.21, 0.47, 0.32, 0.98] as const;

interface MockSlot {
  readonly time: string;
  readonly type: "booked" | "open" | "at-risk";
  readonly specialty?: string;
  readonly doctor?: string;
  readonly patient?: string;
  readonly risk?: number;
}

interface MockDay {
  readonly label: string;
  readonly desktopOnly?: boolean;
  readonly slots: readonly MockSlot[];
}

const CALENDAR_DAYS: readonly MockDay[] = [
  {
    label: "MON 3",
    slots: [
      { time: "9:00–9:30", type: "booked", specialty: "General Checkup", doctor: "Dr. Sarah Chen", patient: "James Wilson" },
      { time: "10:00–10:45", type: "at-risk", specialty: "Dermatology", doctor: "Dr. Marco Rossi", patient: "Emily Davis", risk: 72 },
      { time: "11:00–11:30", type: "booked", specialty: "Orthopedics", doctor: "Dr. Lisa Park", patient: "Tom Martinez" },
      { time: "14:00–14:30", type: "open" },
    ],
  },
  {
    label: "TUE 4",
    slots: [
      { time: "9:00–9:45", type: "booked", specialty: "Cardiology", doctor: "Dr. Sarah Chen", patient: "Anna Lopez" },
      { time: "10:00–10:30", type: "booked", specialty: "Neurology", doctor: "Dr. Lisa Park", patient: "David Kim" },
      { time: "11:00–12:00", type: "booked", specialty: "Physical Therapy", doctor: "Dr. Marco Rossi", patient: "Rachel Green" },
      { time: "14:00–14:30", type: "booked", specialty: "Follow-up", doctor: "Dr. Sarah Chen", patient: "Mike Johnson" },
    ],
  },
  {
    label: "WED 5",
    slots: [
      { time: "9:00–9:30", type: "booked", specialty: "Eye Exam", doctor: "Dr. Lisa Park", patient: "Chris Taylor" },
      { time: "10:00–10:45", type: "at-risk", specialty: "Dental Cleaning", doctor: "Dr. Marco Rossi", patient: "Sarah Brown", risk: 65 },
      { time: "12:00–12:30", type: "open" },
      { time: "14:00–15:00", type: "booked", specialty: "Consultation", doctor: "Dr. Sarah Chen", patient: "Laura White" },
    ],
  },
  {
    label: "THU 6",
    desktopOnly: true,
    slots: [
      { time: "9:00–9:45", type: "booked", specialty: "Pediatrics", doctor: "Dr. Lisa Park", patient: "Mia Rodriguez" },
      { time: "10:00–10:30", type: "booked", specialty: "Allergy Test", doctor: "Dr. Marco Rossi", patient: "Jake Thomas" },
      { time: "11:00–11:30", type: "booked", specialty: "Dermatology", doctor: "Dr. Sarah Chen", patient: "Olivia Scott" },
      { time: "13:00–13:30", type: "booked", specialty: "Follow-up", doctor: "Dr. Lisa Park", patient: "Ben Clark" },
    ],
  },
  {
    label: "FRI 7",
    desktopOnly: true,
    slots: [
      { time: "9:00–9:30", type: "booked", specialty: "General Checkup", doctor: "Dr. Sarah Chen", patient: "Noah Harris" },
      { time: "10:00–10:45", type: "booked", specialty: "Cardiology", doctor: "Dr. Marco Rossi", patient: "Sophia Lee" },
      { time: "11:30–12:00", type: "open" },
      { time: "14:00–14:30", type: "booked", specialty: "Orthopedics", doctor: "Dr. Lisa Park", patient: "Ethan Moore" },
    ],
  },
  {
    label: "SAT 8",
    desktopOnly: true,
    slots: [
      { time: "9:00–9:30", type: "booked", specialty: "Eye Exam", doctor: "Dr. Sarah Chen", patient: "Grace Allen" },
      { time: "10:00–10:30", type: "booked", specialty: "Dental Cleaning", doctor: "Dr. Marco Rossi", patient: "Liam Walker" },
    ],
  },
] as const;

const SLOT_STYLES = {
  booked: "border-emerald-400 bg-emerald-50",
  open: "border-blue-400 bg-blue-50",
  "at-risk": "border-amber-400 bg-amber-50",
} as const;

function SlotCard({ slot }: { readonly slot: MockSlot }) {
  return (
    <div className={cn("rounded-md border-l-2 px-1.5 py-1", SLOT_STYLES[slot.type])}>
      <p className="font-semibold text-gray-700">{slot.time}</p>
      {slot.type === "open" ? (
        <p className="text-blue-500 italic">Open slot</p>
      ) : (
        <>
          <p className="text-gray-500 truncate">{slot.specialty}</p>
          <p className="text-gray-400 truncate">{slot.doctor}</p>
          <p className="font-medium text-gray-600 truncate">{slot.patient}</p>
          {slot.risk && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-1 text-[8px] font-bold text-amber-700 mt-0.5">
              AI: {slot.risk}% risk
            </span>
          )}
        </>
      )}
    </div>
  );
}

function DayColumn({ day }: { readonly day: MockDay }) {
  const isLast = day.label === "SAT 8";
  return (
    <div
      className={cn(
        "flex flex-col",
        !isLast && "border-r border-gray-100",
        day.desktopOnly && "hidden sm:flex",
      )}
    >
      <div className="px-1.5 py-1.5 text-center border-b border-gray-100 bg-gray-50/50">
        <p className="font-semibold text-gray-900">{day.label}</p>
      </div>
      <div className="flex-1 p-1 space-y-1 overflow-hidden">
        {day.slots.map((slot) => (
          <SlotCard key={slot.time} slot={slot} />
        ))}
      </div>
    </div>
  );
}

const SIDEBAR_NAV = [
  { label: "Dashboard", icon: "grid", active: false },
  { label: "Calendar", icon: "calendar", active: true },
  { label: "Appointments", icon: "clipboard", active: false },
  { label: "Waitlist", icon: "list", active: false },
  { label: "Messages", icon: "chat", active: false },
] as const;

const SIDEBAR_ADMIN = [
  { label: "Analytics", icon: "chart" },
  { label: "Settings", icon: "settings" },
  { label: "AI Chat", icon: "zap" },
] as const;

const NAV_ICONS: Record<string, string> = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  calendar: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  clipboard: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  list: "M4 6h16M4 12h16M4 18h7",
  chat: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  chart: "M12 20V10M18 20V4M6 20v-4",
  settings: "M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0",
  zap: "M13 10V3L4 14h7v7l9-11h-7z",
};

function SidebarIcon({ icon }: { readonly icon: string }) {
  const path = NAV_ICONS[icon] ?? "";
  if (icon === "zap") {
    return (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d={path} />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  );
}

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
              className="h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30"
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
              className="h-12 rounded-xl px-8 text-base font-semibold"
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
          transition={{ duration: 0.8, delay: 0.4, ease: [...EASE_OUT_EXPO] }}
        >
          {/* Floating AI notification - top right */}
          <motion.div
            aria-hidden="true"
            className="absolute -top-4 -right-3 z-20 hidden sm:flex items-center gap-2 rounded-xl border border-green-200 bg-white px-3 py-2 shadow-lg shadow-green-600/10"
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
              <Check className="h-3.5 w-3.5 text-green-600" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-900">Slot auto-filled by AI</p>
              <p className="text-[10px] text-gray-400">Waitlist match: 94% score</p>
            </div>
          </motion.div>

          {/* Floating AI notification - bottom left */}
          <motion.div
            aria-hidden="true"
            className="absolute -bottom-3 -left-3 z-20 hidden sm:flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 shadow-lg shadow-blue-600/10"
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 1.6 }}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
              <Zap className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-900">AI reminder sent</p>
              <p className="text-[10px] text-gray-400">Emily Davis — tomorrow 10:00 AM</p>
            </div>
          </motion.div>

          <div aria-hidden="true" role="presentation" className="animate-float rounded-2xl border border-black/[0.08] bg-white p-1.5 shadow-2xl shadow-black/[0.08]">
            <div className="overflow-hidden rounded-xl bg-white">
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
                    <div className="flex items-center gap-1.5 px-2 mb-4">
                      <div className="h-5 w-5 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                        <Zap className="h-3 w-3 text-white" />
                      </div>
                      <span className="font-bold text-[11px] text-gray-900">NowShow</span>
                    </div>
                    <div className="space-y-0.5">
                      {SIDEBAR_NAV.map((item) => (
                        <div
                          key={item.label}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-2 py-1.5",
                            item.active ? "bg-blue-50 font-semibold text-blue-700" : "text-gray-500",
                          )}
                        >
                          <SidebarIcon icon={item.icon} />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="px-2 mb-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
                      <div className="space-y-0.5">
                        {SIDEBAR_ADMIN.map((item) => (
                          <div key={item.label} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-gray-500">
                            <SidebarIcon icon={item.icon} />
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Main area */}
                  <div className="flex-1 min-w-0 flex flex-col bg-white">
                    <div className="px-4 pt-3 pb-2 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-gray-900">Slot Calendar</p>
                          <p className="text-[9px] text-gray-400">View and manage weekly slots</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1">
                            <span className="text-gray-600">Downtown Clinic</span>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-600">
                            <span>Mar 3 — Mar 9</span>
                          </div>
                        </div>
                      </div>
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
                        {CALENDAR_DAYS.map((day) => (
                          <DayColumn key={day.label} day={day} />
                        ))}
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
