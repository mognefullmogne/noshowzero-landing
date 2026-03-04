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

const loginSchema = z.object({
  email: z.string().email("Inserisci un'email valida"),
  password: z.string().min(1, "La password è obbligatoria"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md animate-pulse"><div className="h-96 rounded-2xl bg-gray-100" /></div>}>
      <LoginForm />
    </Suspense>
  );
}

const ALLOWED_MESSAGES: Record<string, string> = {
  "check-email": "Controlla la tua email per confermare il tuo account.",
  "session-expired": "La tua sessione è scaduta. Effettua nuovamente l'accesso.",
  "password-reset": "Password reimpostata con successo. Accedi al tuo account.",
};

function isSafeRedirect(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//") && !url.includes(":");
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messageKey = searchParams.get("message") ?? "";
  const message = ALLOWED_MESSAGES[messageKey] ?? null;
  const rawRedirect = searchParams.get("redirect") ?? "/dashboard";
  const redirect = isSafeRedirect(rawRedirect) ? rawRedirect : "/dashboard";

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginValues) {
    setError(null);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-black/[0.04] bg-white p-8 shadow-xl shadow-black/[0.03]">
        <h1 className="text-2xl font-bold text-gray-900">Bentornato/a</h1>
        <p className="mt-1 text-sm text-gray-500">Accedi al tuo account NoShowZero.</p>

        {message && (
          <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-600">
            {message}
          </div>
        )}

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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Password dimenticata?
              </Link>
            </div>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Inserisci la tua password"
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
                Accesso in corso...
              </>
            ) : (
              "Accedi"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Non hai un account?{" "}
          <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
            Registrati gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
