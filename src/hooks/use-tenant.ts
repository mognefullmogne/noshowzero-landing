"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly industry: string | null;
  readonly business_size: string | null;
  readonly plan: string;
  readonly plan_status: string;
  readonly trial_ends_at: string | null;
  readonly stripe_customer_id: string | null;
  readonly stripe_subscription_id: string | null;
  readonly avg_appointment_value: number;
}

export function useTenant() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTenant() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error: dbError } = await supabase
        .from("tenants")
        .select("id, name, slug, industry, business_size, plan, plan_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, avg_appointment_value")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (dbError) {
        console.error("useTenant: failed to fetch tenant", dbError);
        setError("Failed to load account data. Please refresh the page.");
        setLoading(false);
        return;
      }

      setTenant(data);
      setLoading(false);
    }

    fetchTenant();
  }, []);

  return { tenant, loading, error };
}
