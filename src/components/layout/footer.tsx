import Link from "next/link";
import { Zap } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/pricing" },
    { label: "API Docs", href: "/dashboard" },
    { label: "Integrations", href: "/#how-it-works" },
  ],
  Company: [
    { label: "About", href: "/#" },
    { label: "Blog", href: "/#" },
    { label: "Careers", href: "/#" },
    { label: "Contact", href: "/#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/#" },
    { label: "Terms of Service", href: "/#" },
    { label: "HIPAA Compliance", href: "/#" },
    { label: "GDPR", href: "/#" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-black/[0.04] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                NoShow<span className="text-blue-600">Zero</span>
              </span>
            </Link>
            <p className="mt-4 text-sm text-gray-500 leading-relaxed">
              AI-powered appointment management that eliminates no-shows and fills empty slots
              automatically.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 transition-colors hover:text-gray-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-black/[0.04] pt-8">
          <p className="text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} NoShowZero. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
