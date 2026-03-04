"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Check, User, Lock, Euro } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const profileSchema = z.object({
  name: z.string().min(2, "Il nome deve contenere almeno 2 caratteri"),
  email: z.string().email(),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "La password deve contenere almeno 8 caratteri"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Le password non corrispondono",
    path: ["confirmPassword"],
  });

const clinicSchema = z.object({
  avg_appointment_value: z
    .number()
    .positive("Il valore deve essere positivo")
    .max(10000, "Valore massimo: 10.000"),
});

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;
type ClinicValues = z.infer<typeof clinicSchema>;

export default function SettingsPage() {
  const router = useRouter();
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [clinicSaved, setClinicSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [clinicError, setClinicError] = useState<string | null>(null);
  const [clinicLoading, setClinicLoading] = useState(true);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", email: "" },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  });

  const clinicForm = useForm<ClinicValues>({
    resolver: zodResolver(clinicSchema),
    defaultValues: { avg_appointment_value: 80 },
  });

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        profileForm.reset({
          name: user.user_metadata?.full_name ?? "",
          email: user.email ?? "",
        });
      }
    }

    async function loadClinicSettings() {
      try {
        const res = await fetch("/api/settings/tenant");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            clinicForm.reset({
              avg_appointment_value: data.data.avg_appointment_value,
            });
          }
        }
      } catch {
        /* non-blocking */
      }
      setClinicLoading(false);
    }

    loadUser();
    loadClinicSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onProfileSubmit(values: ProfileValues) {
    setProfileError(null);
    setProfileSaved(false);
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      data: { full_name: values.name },
    });

    if (error) {
      setProfileError(error.message);
      return;
    }

    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  }

  async function onPasswordSubmit(values: PasswordValues) {
    setPasswordError(null);
    setPasswordSaved(false);
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setPasswordSaved(true);
    passwordForm.reset();
    setTimeout(() => setPasswordSaved(false), 3000);
  }

  async function onClinicSubmit(values: ClinicValues) {
    setClinicError(null);
    setClinicSaved(false);
    const res = await fetch("/api/settings/tenant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        avg_appointment_value: values.avg_appointment_value,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setClinicError(data.error?.message ?? "Errore nel salvataggio");
      return;
    }
    setClinicSaved(true);
    setTimeout(() => setClinicSaved(false), 3000);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Impostazioni</h1>
      <p className="mt-1 text-sm text-gray-500">Gestisci il tuo account e le tue preferenze.</p>

      {/* Profile */}
      <div className="mt-8 rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <User className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Profilo</h2>
            <p className="text-sm text-gray-500">Aggiorna le tue informazioni personali.</p>
          </div>
        </div>

        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Nome e cognome</Label>
            <Input
              id="name"
              className="mt-1 rounded-xl"
              {...profileForm.register("name")}
            />
            {profileForm.formState.errors.name && (
              <p className="mt-1 text-xs text-red-500">
                {profileForm.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              className="mt-1 rounded-xl"
              disabled
              {...profileForm.register("email")}
            />
            <p className="mt-1 text-xs text-gray-400">
              L&apos;email non può essere modificata da qui.
            </p>
          </div>

          {profileError && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {profileError}
            </div>
          )}

          <Button
            type="submit"
            disabled={profileForm.formState.isSubmitting}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
          >
            {profileForm.formState.isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : profileSaved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {profileSaved ? "Salvato" : "Salva modifiche"}
          </Button>
        </form>
      </div>

      {/* Clinic Settings */}
      <div className="mt-6 rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
            <Euro className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Impostazioni Clinica
            </h2>
            <p className="text-sm text-gray-500">
              Configura il valore medio degli appuntamenti per il calcolo del
              ricavo recuperato.
            </p>
          </div>
        </div>

        {clinicLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Caricamento...
          </div>
        ) : (
          <form
            onSubmit={clinicForm.handleSubmit(onClinicSubmit)}
            className="mt-6 space-y-4"
          >
            <div>
              <Label htmlFor="avg_appointment_value">
                Valore medio appuntamento (EUR)
              </Label>
              <Input
                id="avg_appointment_value"
                type="number"
                step="0.01"
                min="1"
                max="10000"
                placeholder="80.00"
                className="mt-1 rounded-xl"
                {...clinicForm.register("avg_appointment_value", { valueAsNumber: true })}
              />
              {clinicForm.formState.errors.avg_appointment_value && (
                <p className="mt-1 text-xs text-red-500">
                  {clinicForm.formState.errors.avg_appointment_value.message}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Questo valore viene usato per calcolare il ricavo recuperato
                quando uno slot cancellato viene riempito.
              </p>
            </div>

            {clinicError && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {clinicError}
              </div>
            )}

            <Button
              type="submit"
              disabled={clinicForm.formState.isSubmitting}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            >
              {clinicForm.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : clinicSaved ? (
                <Check className="mr-2 h-4 w-4" />
              ) : null}
              {clinicSaved ? "Salvato" : "Salva"}
            </Button>
          </form>
        )}
      </div>

      {/* Password */}
      <div className="mt-6 rounded-2xl border border-black/[0.04] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
            <Lock className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Password</h2>
            <p className="text-sm text-gray-500">Aggiorna la tua password.</p>
          </div>
        </div>

        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="password">Nuova password</Label>
            <Input
              id="password"
              type="password"
              className="mt-1 rounded-xl"
              placeholder="Min. 8 caratteri"
              {...passwordForm.register("password")}
            />
            {passwordForm.formState.errors.password && (
              <p className="mt-1 text-xs text-red-500">
                {passwordForm.formState.errors.password.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Conferma nuova password</Label>
            <Input
              id="confirmPassword"
              type="password"
              className="mt-1 rounded-xl"
              placeholder="Ripeti la password"
              {...passwordForm.register("confirmPassword")}
            />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-500">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          {passwordError && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {passwordError}
            </div>
          )}

          <Button
            type="submit"
            disabled={passwordForm.formState.isSubmitting}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
          >
            {passwordForm.formState.isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : passwordSaved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {passwordSaved ? "Password aggiornata" : "Aggiorna password"}
          </Button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/50 p-6">
        <h2 className="text-lg font-bold text-red-900">Zona pericolosa</h2>
        <p className="mt-1 text-sm text-red-600">
          Esci dal tuo account. I tuoi dati non verranno eliminati.
        </p>
        <Button
          variant="outline"
          className="mt-4 rounded-xl border-red-300 text-red-600 hover:bg-red-50"
          onClick={handleSignOut}
        >
          Esci
        </Button>
      </div>
    </div>
  );
}
