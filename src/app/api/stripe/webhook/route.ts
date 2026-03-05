// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  const supabase = await createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenant_id;
      const rawTier = session.metadata?.tier ?? "growth";
      const VALID_TIERS = ["growth", "pro", "enterprise"];
      const tier = VALID_TIERS.includes(rawTier) ? rawTier : "growth";
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (tenantId) {
        const { error: dbError } = await supabase
          .from("tenants")
          .update({
            plan: tier,
            plan_status: "trialing",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenantId);

        if (dbError) {
          console.error("Failed to update tenant after checkout:", dbError);
          return NextResponse.json({ error: "Database update failed" }, { status: 500 });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const status = subscription.status;

      const planStatus =
        status === "active"
          ? "active"
          : status === "trialing"
            ? "trialing"
            : status === "past_due"
              ? "past_due"
              : "canceled";

      const { error: dbError } = await supabase
        .from("tenants")
        .update({
          plan_status: planStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);

      if (dbError) {
        console.error("Failed to update subscription status:", dbError);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { error: dbError } = await supabase
        .from("tenants")
        .update({
          plan_status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);

      if (dbError) {
        console.error("Failed to mark subscription canceled:", dbError);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { error: dbError } = await supabase
        .from("tenants")
        .update({
          plan_status: "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);

      if (dbError) {
        console.error("Failed to mark payment as past_due:", dbError);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
