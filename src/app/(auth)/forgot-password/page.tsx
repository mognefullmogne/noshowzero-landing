"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const forgotSchema = z.object({
  email: z.string().email("Inserisci un'email valida"),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
  });

  async function onSubmit(values: ForgotValues) {
    setError(null);
    const supabase = createClient();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/callback?type=recovery`,
    });

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-black/[0.04] bg-white p-8 text-center shadow-xl shadow-black/[0.03]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Controlla la tua email</h1>
          <p className="mt-2 text-sm text-gray-500">
            Abbiamo inviato un link per reimpostare la password al tuo indirizzo email. Clicca il
            link per continuare.
          </p>
          <Button asChild variant="outline" className="mt-6 w-full rounded-xl">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna all&apos;accesso
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-black/[0.04] bg-white p-8 shadow-xl shadow-black/[0.03]">
        <h1 className="text-2xl font-bold text-gray-900">Reimposta la password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Inserisci la tua email e ti invieremo un link per reimpostare la password.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
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

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Invio in corso...
              </>
            ) : (
              "Invia link di reimpostazione"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">
            <ArrowLeft className="mr-1 inline-block h-3 w-3" />
            Torna all&apos;accesso
          </Link>
        </p>
      </div>
    </div>
  );
}
