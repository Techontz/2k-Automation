"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField, NativeSelect } from "@/components/settings/form-kit";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { EmailProvider } from "./types";

const EMPTY = { driver: "smtp" as EmailProvider["driver"], name: "", from_name: "", from_email: "", host: "", port: "587", username: "", password: "", encryption: "tls" };

export function ProviderDialog(props: React.ComponentProps<typeof ProviderDialogBody> & { open: boolean }) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <ProviderDialogBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function ProviderDialogBody({
  onOpenChange,
  provider,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: EmailProvider | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() =>
    // Credentials are write-only: never prefill host/user/password from the server.
    provider ? { ...EMPTY, driver: provider.driver, name: provider.name, from_name: provider.from_name, from_email: provider.from_email } : EMPTY,
  );
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const set = (key: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value });

  async function save() {
    setPending(true);
    setErrors({});
    const body: Record<string, unknown> = { name: form.name, from_name: form.from_name, from_email: form.from_email };

    // On edit, omit an unchanged driver so the API does not demand the (write-only) host again.
    if (!provider || provider.driver !== form.driver) {
      body.driver = form.driver;
    }

    if (form.driver === "smtp") {
      const credentials = Object.fromEntries(
        Object.entries({ host: form.host, port: form.port ? Number(form.port) : undefined, username: form.username, password: form.password, encryption: form.encryption }).filter(
          ([, value]) => value !== undefined && value !== "",
        ),
      );
      // Blank fields are dropped server-side on update, so saved secrets are kept.
      body.credentials = credentials;
    }

    try {
      if (provider) {
        await api.patch(`email/providers/${provider.id}`, body);
      } else {
        await api.post("email/providers", body);
      }
      toast.success(provider ? "Provider updated" : "Provider connected");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.errors);
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>{provider ? "Edit email provider" : "Connect an email provider"}</DialogTitle>
          <DialogDescription>Use any SMTP service — Amazon SES, Resend, Postmark, Mailgun or your own server.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {(["smtp", "log"] as const).map((driver) => (
            <button
              key={driver}
              type="button"
              onClick={() => setForm({ ...form, driver })}
              className={cn("rounded-lg border p-3 text-left transition-colors", form.driver === driver ? "border-brand bg-brand-soft/50 ring-2 ring-brand/15" : "hover:bg-muted")}
            >
              <span className="block text-sm font-medium">{driver === "smtp" ? "SMTP" : "Log (development)"}</span>
              <span className="block text-xs text-muted-foreground">{driver === "smtp" ? "Send real email" : "Write emails to the server log"}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Display name" htmlFor="pv-name" error={errors.name?.[0]} className="sm:col-span-2">
            <Input id="pv-name" value={form.name} onChange={set("name")} placeholder="Amazon SES" />
          </FormField>
          <FormField label="From name" htmlFor="pv-from-name" error={errors.from_name?.[0]}>
            <Input id="pv-from-name" value={form.from_name} onChange={set("from_name")} placeholder="2K Studio" />
          </FormField>
          <FormField label="From email" htmlFor="pv-from-email" error={errors.from_email?.[0]}>
            <Input id="pv-from-email" type="email" value={form.from_email} onChange={set("from_email")} placeholder="hello@yourbrand.com" />
          </FormField>

          {form.driver === "smtp" && (
            <>
              <FormField label="SMTP host" htmlFor="pv-host" error={errors["credentials.host"]?.[0]} className="sm:col-span-2" hint={provider ? "Leave blank to keep the saved value." : undefined}>
                <Input id="pv-host" value={form.host} onChange={set("host")} placeholder="email-smtp.eu-west-1.amazonaws.com" autoComplete="off" />
              </FormField>
              <FormField label="Port" htmlFor="pv-port">
                <Input id="pv-port" inputMode="numeric" value={form.port} onChange={set("port")} />
              </FormField>
              <FormField label="Encryption" htmlFor="pv-enc">
                <NativeSelect id="pv-enc" value={form.encryption} onChange={set("encryption")}>
                  <option value="tls">TLS (587)</option>
                  <option value="ssl">SSL (465)</option>
                  <option value="null">None</option>
                </NativeSelect>
              </FormField>
              <FormField label="Username" htmlFor="pv-user">
                <Input id="pv-user" value={form.username} onChange={set("username")} autoComplete="off" />
              </FormField>
              <FormField label="Password" htmlFor="pv-pass" hint={provider ? "Leave blank to keep the saved password." : undefined}>
                <Input id="pv-pass" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" placeholder={provider ? "••••••••" : ""} />
              </FormField>
            </>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" /> Credentials are encrypted at rest and never shown again.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {provider ? "Save" : "Connect provider"}
          </Button>
        </DialogFooter>
    </>
  );
}
