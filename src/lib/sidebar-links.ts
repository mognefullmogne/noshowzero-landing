import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  Users,
  Gift,
  MessageSquare,
  Plug,
  Bot,
  Sparkles,
  Settings2,
  Brain,
  ScrollText,
  BarChart3,
  BookOpen,
  CreditCard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface SidebarLink {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
}

export const DEFAULT_SIDEBAR_LINKS: readonly SidebarLink[] = [
  { label: "Bacheca", href: "/dashboard", icon: LayoutDashboard },
  { label: "Appuntamenti", href: "/appointments", icon: CalendarDays },
  { label: "Calendario", href: "/calendar", icon: CalendarRange },
  { label: "Lista d'attesa", href: "/waitlist", icon: Users },
  { label: "Offerte", href: "/offers", icon: Gift },
  { label: "Messaggi", href: "/messages", icon: MessageSquare },
  { label: "Integrazioni", href: "/integrations", icon: Plug },
  { label: "Chat AI", href: "/ai-chat", icon: Bot },
  { label: "Ottimizzazione", href: "/optimization", icon: Sparkles },
  { label: "Regole", href: "/rules", icon: Settings2 },
  { label: "Strategia AI", href: "/strategy-log", icon: Brain },
  { label: "Audit", href: "/audit", icon: ScrollText },
  { label: "Statistiche", href: "/analytics", icon: BarChart3 },
  { label: "Documentazione API", href: "/docs", icon: BookOpen },
  { label: "Fatturazione", href: "/billing", icon: CreditCard },
  { label: "Impostazioni", href: "/settings", icon: Settings },
];

/** Set of all valid sidebar hrefs — used for validation */
export const SIDEBAR_HREFS = new Set(DEFAULT_SIDEBAR_LINKS.map((l) => l.href));

/** Map href → SidebarLink for fast lookup when reordering */
export const SIDEBAR_BY_HREF = new Map(DEFAULT_SIDEBAR_LINKS.map((l) => [l.href, l]));

/**
 * Return sidebar links in custom order if provided, otherwise default order.
 * Unknown hrefs are silently dropped; missing hrefs are appended at the end.
 */
export function getOrderedSidebarLinks(customOrder: string[] | null): readonly SidebarLink[] {
  if (!customOrder) return DEFAULT_SIDEBAR_LINKS;

  const ordered: SidebarLink[] = [];
  const seen = new Set<string>();

  for (const href of customOrder) {
    const link = SIDEBAR_BY_HREF.get(href);
    if (link && !seen.has(href)) {
      ordered.push(link);
      seen.add(href);
    }
  }

  // Append any links missing from the custom order
  for (const link of DEFAULT_SIDEBAR_LINKS) {
    if (!seen.has(link.href)) {
      ordered.push(link);
    }
  }

  return ordered;
}
