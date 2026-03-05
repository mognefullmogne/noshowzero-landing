// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { Hero } from "@/components/landing/hero";
import { SocialProof } from "@/components/landing/social-proof";
import { ProblemStats } from "@/components/landing/problem-stats";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { Industries } from "@/components/landing/industries";
import { PricingSection } from "@/components/landing/pricing-section";
import { Testimonials } from "@/components/landing/testimonials";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ChatWidget } from "@/components/chat/chat-widget";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <ProblemStats />
        <HowItWorks />
        <FeaturesGrid />
        <Industries />
        <PricingSection />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <ChatWidget />
    </>
  );
}
