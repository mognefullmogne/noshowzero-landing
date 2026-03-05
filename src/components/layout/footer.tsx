// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import Link from "next/link";
import { Zap } from "lucide-react";

const footerLinks = {
  Prodotto: [
    { label: "Funzionalità", href: "/#features" },
    { label: "Prezzi", href: "/pricing" },
    { label: "Documentazione API", href: "/dashboard" },
    { label: "Integrazioni", href: "/#how-it-works" },
  ],
  Azienda: [
    { label: "Chi Siamo", href: "/#" },
    { label: "Blog", href: "/#" },
    { label: "Lavora con Noi", href: "/#" },
    { label: "Contatti", href: "/#" },
  ],
  "Note Legali": [
    { label: "Informativa Privacy", href: "/#" },
    { label: "Condizioni di Servizio", href: "/#" },
    { label: "HIPAA Compliance", href: "/#" },
    { label: "GDPR", href: "/#" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-500">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Now<span className="text-teal-600">Show</span>
              </span>
            </Link>
            <p className="mt-4 text-sm text-slate-500 leading-relaxed">
              Gestione appuntamenti con IA che elimina i no-show e riempie gli slot vuoti
              automaticamente.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-teal-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-slate-100 pt-8">
          <p className="text-center text-sm text-slate-400">
            &copy; {new Date().getFullYear()} NoShow. Tutti i diritti riservati.
          </p>
        </div>
      </div>
    </footer>
  );
}
