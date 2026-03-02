import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, getPriceId } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tier, interval } = body as { tier: string; interval: "monthly" | "annual" };

    if (!tier || !interval) {
      return NextResponse.json({ error: "Missing tier or interval" }, { status: 400 });
    }

    const priceId = getPriceId(tier, interval);
    if (!priceId) {
      return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 });
    }

    // Get or create tenant record
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, stripe_customer_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    let customerId = tenant?.stripe_customer_id;

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.user_metadata?.full_name ?? undefined,
        metadata: {
          supabase_user_id: user.id,
          tenant_id: tenant?.id ?? "",
        },
      });
      customerId = customer.id;

      // Save Stripe customer ID
      if (tenant) {
        await supabase
          .from("tenants")
          .update({ stripe_customer_id: customerId })
          .eq("id", tenant.id);
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          tenant_id: tenant?.id ?? "",
          tier,
        },
      },
      metadata: {
        tenant_id: tenant?.id ?? "",
        tier,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
