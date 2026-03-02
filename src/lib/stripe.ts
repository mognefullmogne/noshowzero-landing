import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

export function getPriceId(tier: string, interval: "monthly" | "annual"): string | null {
  const map: Record<string, string | undefined> = {
    "growth-monthly": process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    "growth-annual": process.env.STRIPE_PRICE_GROWTH_ANNUAL,
    "pro-monthly": process.env.STRIPE_PRICE_PRO_MONTHLY,
    "pro-annual": process.env.STRIPE_PRICE_PRO_ANNUAL,
    "enterprise-monthly": process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    "enterprise-annual": process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL,
  };
  return map[`${tier}-${interval}`] ?? null;
}
