import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PricingSection } from "@/components/landing/pricing-section";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { ChatWidget } from "@/components/chat/chat-widget";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — NoShowZero",
  description:
    "Simple, transparent pricing for NoShowZero. Start free for 14 days. Plans from $49/mo.",
};

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        <PricingSection />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <ChatWidget />
    </>
  );
}
