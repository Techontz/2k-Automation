"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const invitation = params.get("invite");

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invitation ? { ...form, invitation_token: invitation } : form),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const fieldErrors = Object.fromEntries(Object.entries((data.errors ?? {}) as Record<string, string[]>).map(([key, value]) => [key, value[0]]));
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: data.message ?? "Something went wrong." });
      setPending(false);
      return;
    }

    router.push(mode === "register" ? "/onboarding" : params.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mode === "login" ? "Sign in to your 2K Automation workspace." : "Start automating in minutes — no credit card required."}
        </p>
      </div>

      {mode === "register" && (
        <Field label="Full name" name="name" error={errors.name} autoComplete="name" required />
      )}
      <Field label="Email" name="email" type="email" error={errors.email} autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        error={errors.password}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        hint={mode === "register" ? "At least 10 characters with letters and numbers." : undefined}
        required
      />
      {mode === "register" && !params.get("invite") && (
        <Field label="Workspace name" name="workspace_name" placeholder="e.g. Amina Creative" error={errors.workspace_name} />
      )}

      {errors.form && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p>}

      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>New to 2K Automation? <Link href="/register" className="font-medium text-brand hover:underline">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link></>
        )}
      </p>
    </form>
  );
}

function Field({ label, error, hint, ...props }: React.ComponentProps<typeof Input> & { label: string; error?: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} className="h-10" aria-invalid={Boolean(error)} {...props} />
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
