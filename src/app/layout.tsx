import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NowShow — Eliminate No-Shows with AI",
  description:
    "AI-powered appointment management that reduces no-shows by up to 80%. Smart reminders, AI waitlists, and automatic slot filling for any appointment-based business.",
  keywords: [
    "no-show",
    "appointment management",
    "AI reminders",
    "waitlist",
    "scheduling",
    "healthcare",
    "salon",
    "booking",
  ],
  openGraph: {
    title: "NowShow — Eliminate No-Shows with AI",
    description:
      "Smart reminders, AI-powered waitlists, and automatic slot filling. Reduce no-shows by up to 80%.",
    type: "website",
    url: "https://noshowzero-landing.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "NowShow — Eliminate No-Shows with AI",
    description:
      "Smart reminders, AI-powered waitlists, and automatic slot filling. Reduce no-shows by up to 80%.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-right" richColors visibleToasts={3} />
      </body>
    </html>
  );
}
