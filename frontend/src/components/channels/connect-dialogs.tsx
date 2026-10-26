"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export interface NotConfigured {
  platform: string;
  missing: string[];
  redirect_uri?: string;
}

/** Explains which backend env vars are needed before a platform can be connected. */
export function NotConfiguredDialog({ info, onClose }: { info: NotConfigured | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <Dialog open={info !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Finish setting up {info?.platform}</DialogTitle>
          <DialogDescription>
            This integration needs your own developer app credentials. Add them to <code className="rounded bg-muted px-1">backend/.env</code> and restart the API.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-1.5 font-medium">Missing environment variables</p>
            <div className="space-y-1 rounded-lg bg-muted p-3 font-mono text-xs">
              {info?.missing.map((name) => <div key={name}>{name}=</div>)}
            </div>
          </div>
          {info?.redirect_uri && (
            <div>
              <p className="mb-1.5 font-medium">OAuth redirect URI to register</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{info.redirect_uri}</code>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Copy redirect URI"
                  onClick={() => {
                    navigator.clipboard.writeText(info.redirect_uri ?? "");
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            </div>
          )}
          <p className="text-muted-foreground">
            Step-by-step instructions (creating the Meta/TikTok app, permissions, App Review and webhooks) are in <code className="rounded bg-muted px-1">docs/SETUP_INTEGRATIONS.md</code>.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Manual WhatsApp Cloud API connection with a system user token. */
export function WhatsAppDialog({
  open,
  onOpenChange,
  onConnected,
  onNotConfigured,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
  onNotConfigured: (info: NotConfigured) => void;
}) {
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.post("channels/whatsapp", form);
      toast.success("WhatsApp Business connected.");
      onOpenChange(false);
      onConnected();
    } catch (error) {
      if (error instanceof ApiError && error.data.code === "integration_not_configured") {
        onOpenChange(false);
        onNotConfigured({ platform: "WhatsApp Business", missing: (error.data.missing as string[]) ?? [] });
      } else {
        toast.error((error as Error).message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Connect WhatsApp Business</DialogTitle>
            <DialogDescription>
              Find these in Meta Business Manager → WhatsApp Manager. Use a permanent system user token with <code>whatsapp_business_messaging</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="phone_number_id">Phone number ID</Label>
            <Input id="phone_number_id" name="phone_number_id" required placeholder="1234567890" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="waba_id">WhatsApp Business Account ID</Label>
            <Input id="waba_id" name="waba_id" required placeholder="9876543210" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="access_token">System user access token</Label>
            <Input id="access_token" name="access_token" type="password" required autoComplete="off" />
            <p className="text-xs text-muted-foreground">Stored encrypted. Never shown again.</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
