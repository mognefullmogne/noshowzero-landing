// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/shared/scroll-reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#09090b] px-4 py-24 sm:px-6 lg:px-8">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[400px] w-[400px] rounded-full bg-teal-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-[300px] w-[300px] rounded-full bg-cyan-500/8 blur-3xl" />
      </div>

      {/* Dot pattern overlay */}
      <div className="pointer-events-none absolute inset-0 bg-dot-pattern opacity-[0.03]" />

      <div className="relative mx-auto max-w-3xl text-center">
        <ScrollReveal>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Pronto a Eliminare i{" "}
            <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              No-Show
            </span>
            ?
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Unisciti a oltre 500 attività che hanno ridotto i no-show fino all&apos;80%.
            Inizia oggi la tua prova gratuita di 14 giorni.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              asChild
              className="h-13 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-400 px-8 text-base font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-xl hover:brightness-110"
            >
              <Link href="/signup">
                Inizia Gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-13 rounded-xl border-white/20 bg-white/5 px-8 text-base font-semibold text-white hover:bg-white/10 hover:border-white/30"
            >
              <Link href="/pricing">Vedi i Prezzi</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Nessuna carta di credito &middot; 14 giorni di prova gratuita &middot; Cancella quando vuoi
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
