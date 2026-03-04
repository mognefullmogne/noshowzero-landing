"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { SectionWrapper } from "@/components/shared/section-wrapper";
import { FAQ_ITEMS } from "@/lib/constants";

export function Faq() {
  return (
    <SectionWrapper id="faq">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <ScrollReveal>
            <p className="text-sm font-semibold text-teal-600 uppercase tracking-wider">FAQ</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Domande Frequenti
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              Tutto quello che devi sapere su NoShowZero.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={0.1}>
          <Accordion type="single" collapsible className="mt-12">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-base font-semibold text-slate-900 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-500 leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </SectionWrapper>
  );
}
