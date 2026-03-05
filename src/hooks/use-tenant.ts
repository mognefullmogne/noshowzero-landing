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
  readonly sidebar_order: string[] | null;
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

      // Try with avg_appointment_value first; fall back without it if column doesn't exist yet (migration 013)
      let data: Tenant | null = null;
      const fullSelect = "id, name, slug, industry, business_size, plan, plan_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, avg_appointment_value, sidebar_order";
      const fallbackSelect = "id, name, slug, industry, business_size, plan, plan_status, trial_ends_at, stripe_customer_id, stripe_subscription_id";

      const { data: fullData, error: fullError } = await supabase
        .from("tenants")
        .select(fullSelect)
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (fullError && fullError.code === "42703") {
        // Column doesn't exist yet — use fallback without avg_appointment_value
        const { data: fallbackData, error: fbError } = await supabase
          .from("tenants")
          .select(fallbackSelect)
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (fbError) {
          console.error("useTenant: failed to fetch tenant", fbError);
          setError("Failed to load account data. Please refresh the page.");
          setLoading(false);
          return;
        }
        data = fallbackData ? { ...fallbackData, avg_appointment_value: 80, sidebar_order: null } as Tenant : null;
      } else if (fullError) {
        console.error("useTenant: failed to fetch tenant", fullError);
        setError("Failed to load account data. Please refresh the page.");
        setLoading(false);
        return;
      } else {
        data = fullData;
      }

      setTenant(data);
      setLoading(false);
    }

    fetchTenant();
  }, []);

  return { tenant, loading, error };
}
