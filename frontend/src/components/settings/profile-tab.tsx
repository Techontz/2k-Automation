"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api";
import { FormField, SectionCard } from "./form-kit";

export function ProfileTab() {
  const { user } = useSession();

  if (!user) return null;

  return <ProfileForms key={`${user.id}:${user.name}:${user.email}`} />;
}

function ProfileForms() {
  const { user, mutate } = useSession();
  const [profile, setProfile] = useState({ name: user?.name ?? "", email: user?.email ?? "" });
  const [passwords, setPasswords] = useState({ current_password: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState<"profile" | "password" | null>(null);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setPending("profile");
    setErrors({});
    try {
      await api.patch("auth/me", profile);
      await mutate();
      toast.success("Profile updated");
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.errors);
      toast.error((error as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (passwords.password !== passwords.confirm) {
      setErrors({ confirm: ["Passwords do not match."] });
      return;
    }
    setPending("password");
    setErrors({});
    try {
      await api.patch("auth/me", { current_password: passwords.current_password, password: passwords.password });
      setPasswords({ current_password: "", password: "", confirm: "" });
      toast.success("Password changed. Other sessions were signed out.");
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.errors);
      toast.error((error as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Your profile" description="How teammates see you in the inbox and audit log.">
        <form onSubmit={saveProfile} className="space-y-4">
          <FormField label="Full name" htmlFor="pf-name" error={errors.name?.[0]}>
            <Input id="pf-name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} autoComplete="name" />
          </FormField>
          <FormField label="Email" htmlFor="pf-email" error={errors.email?.[0]}>
            <Input id="pf-email" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} autoComplete="email" />
          </FormField>
          <Button type="submit" disabled={pending !== null || (profile.name === user?.name && profile.email === user?.email)}>
            {pending === "profile" && <Loader2 className="size-4 animate-spin" />}
            Save profile
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Password" description="Changing your password signs you out everywhere else.">
        <form onSubmit={savePassword} className="space-y-4">
          <FormField label="Current password" htmlFor="pw-current" error={errors.current_password?.[0]}>
            <Input id="pw-current" type="password" value={passwords.current_password} onChange={(event) => setPasswords({ ...passwords, current_password: event.target.value })} autoComplete="current-password" />
          </FormField>
          <FormField label="New password" htmlFor="pw-new" error={errors.password?.[0]} hint="At least 10 characters with letters and numbers.">
            <Input id="pw-new" type="password" value={passwords.password} onChange={(event) => setPasswords({ ...passwords, password: event.target.value })} autoComplete="new-password" />
          </FormField>
          <FormField label="Confirm new password" htmlFor="pw-confirm" error={errors.confirm?.[0]}>
            <Input id="pw-confirm" type="password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} autoComplete="new-password" />
          </FormField>
          <Button type="submit" variant="outline" disabled={pending !== null || !passwords.current_password || !passwords.password}>
            {pending === "password" && <Loader2 className="size-4 animate-spin" />}
            Change password
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
