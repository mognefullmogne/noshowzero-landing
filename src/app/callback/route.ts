import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password recovery flow
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/settings`);
      }

      // Check if user has a tenant record — if not, go to onboarding
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!tenant) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Error: redirect to login with error
  return NextResponse.redirect(`${origin}/login?message=Authentication failed. Please try again.`);
}
