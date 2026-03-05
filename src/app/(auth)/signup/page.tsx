// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/auth/google-button";
import { createClient } from "@/lib/supabase/client";

const signupSchema = z.object({
  name: z.string().min(2, "Il nome deve contenere almeno 2 caratteri"),
  email: z.string().email("Inserisci un'email valida"),
  password: z.string().min(8, "La password deve contenere almeno 8 caratteri"),
});

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md animate-pulse"><div className="h-96 rounded-2xl bg-gray-100" /></div>}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "growth";
  const interval = searchParams.get("interval") ?? "monthly";

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
  });

  async function onSubmit(values: SignupValues) {
    setError(null);
    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.name,
          plan,
          interval,
        },
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Check if email confirmation is required
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      router.push("/onboarding");
    } else {
      router.push("/login?message=check-email");
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-black/[0.04] bg-white p-8 shadow-xl shadow-black/[0.03]">
        <h1 className="text-2xl font-bold text-gray-900">Crea il tuo account</h1>
        <p className="mt-1 text-sm text-gray-500">
          Inizia la tua prova gratuita di 14 giorni. Nessuna carta richiesta.
        </p>

        <div className="mt-6">
          <GoogleButton />
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-black/[0.06]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-gray-400">o continua con l&apos;email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome e cognome</Label>
            <Input
              id="name"
              type="text"
              placeholder="Mario Rossi"
              className="mt-1 rounded-xl"
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              className="mt-1 rounded-xl"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 caratteri"
                className="rounded-xl pr-10"
                {...register("password")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creazione account...
              </>
            ) : (
              "Crea account"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Hai già un account?{" "}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}
