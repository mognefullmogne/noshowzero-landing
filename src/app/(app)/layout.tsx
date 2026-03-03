"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Zap,
  LayoutDashboard,
  CreditCard,
  Settings,
  LogOut,
  Rocket,
  BookOpen,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/hooks/use-tenant";
import { cn } from "@/lib/utils";
import { ChatWidget } from "@/components/chat/chat-widget";

const sidebarLinks = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "API Docs", href: "/docs", icon: BookOpen },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenant, loading, error: tenantError } = useTenant();

  const isOnboarding = pathname === "/onboarding";

  // Redirect to onboarding if no tenant exists (except if already on onboarding or error)
  useEffect(() => {
    if (!loading && !tenant && !tenantError && !isOnboarding) {
      router.replace("/onboarding");
    }
  }, [loading, tenant, tenantError, isOnboarding, router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (isOnboarding) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-black/[0.04] bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                Now<span className="text-blue-600">Show</span>
              </span>
            </Link>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Rocket className="h-4 w-4" />
              Setup Wizard
            </div>
          </div>
        </header>
        {children}
      </div>
    );
  }

  // Show loading spinner while checking tenant
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Show error state if tenant fetch failed
  if (tenantError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <p className="text-sm font-medium text-red-600">{tenantError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-blue-600 underline hover:text-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // If no tenant, the useEffect will redirect — show nothing while redirecting
  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-black/[0.04] bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-black/[0.04] px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Now<span className="text-blue-600">Show</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-black/[0.04] p-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sm text-gray-500 hover:text-red-600"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 pl-64">
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </main>

      <ChatWidget />
    </div>
  );
}
