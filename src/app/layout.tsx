// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "NoShow — Elimina i No-Show con l'IA",
  description:
    "Gestione appuntamenti con IA che riduce i no-show fino all'80%. Promemoria intelligenti, liste d'attesa IA e riempimento automatico degli slot per qualsiasi attività su appuntamento.",
  keywords: [
    "no-show",
    "gestione appuntamenti",
    "promemoria IA",
    "lista d'attesa",
    "prenotazioni",
    "sanità",
    "salone",
    "booking",
  ],
  openGraph: {
    title: "NoShow — Elimina i No-Show con l'IA",
    description:
      "Promemoria intelligenti, liste d'attesa IA e riempimento automatico degli slot. Riduci i no-show fino all'80%.",
    type: "website",
    url: "https://noshowzero-landing.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "NoShow — Elimina i No-Show con l'IA",
    description:
      "Promemoria intelligenti, liste d'attesa IA e riempimento automatico degli slot. Riduci i no-show fino all'80%.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="scroll-smooth">
      <body className={`${sora.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-right" richColors visibleToasts={3} />
      </body>
    </html>
  );
}
