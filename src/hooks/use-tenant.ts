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
}

export function useTenant() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

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

      const { data } = await supabase
        .from("tenants")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      setTenant(data);
      setLoading(false);
    }

    fetchTenant();
  }, []);

  return { tenant, loading };
}
