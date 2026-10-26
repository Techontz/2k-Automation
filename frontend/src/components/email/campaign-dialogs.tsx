"use client";

import { useState } from "react";
import useSWR from "swr";
import { CalendarClock, Loader2, Send, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField, NativeSelect } from "@/components/settings/form-kit";
import { api, ApiError } from "@/lib/api";
import type { Tag } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { EmailCampaign, EmailProvider, EmailTemplate } from "./types";

export function CreateCampaignDialog(props: React.ComponentProps<typeof CreateCampaignDialogBody> & { open: boolean }) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <CreateCampaignDialogBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function CreateCampaignDialogBody({
  onOpenChange,
  templates,
  providers,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: EmailTemplate[];
  providers: EmailProvider[];
  onCreated: (campaign: EmailCampaign) => void;
}) {
  const { data: tags } = useSWR<{ data: Tag[] }>("tags");
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(() => String(templates.find((template) => template.category === "marketing")?.id ?? templates[0]?.id ?? ""));
  const [providerId, setProviderId] = useState(() => String(providers.find((provider) => provider.is_default)?.id ?? ""));
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function create() {
    setPending(true);
    setErrors({});
    try {
      const campaign = await api.post<EmailCampaign>("email/campaigns", {
        name,
        email_template_id: Number(templateId),
        email_provider_id: providerId ? Number(providerId) : null,
        audience: { tag_ids: tagIds },
      });
      toast.success("Campaign created");
      onCreated(campaign);
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
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>Send a template to contacts who opted in to marketing email.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField label="Campaign name" htmlFor="cp-name" error={errors.name?.[0]}>
            <Input id="cp-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="November product launch" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Template" htmlFor="cp-template" error={errors.email_template_id?.[0]}>
              <NativeSelect id="cp-template" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                {templates.length === 0 && <option value="">No templates yet</option>}
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.category})
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Send with" htmlFor="cp-provider">
              <NativeSelect id="cp-provider" value={providerId} onChange={(event) => setProviderId(event.target.value)}>
                <option value="">Default provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <FormField label="Audience" hint={tagIds.length ? "Contacts with any of the selected tags." : "All subscribed contacts. Select tags to narrow the audience."}>
            <div className="flex min-h-9 flex-wrap gap-1.5 rounded-lg border p-2">
              {tags?.data.length === 0 && <span className="text-xs text-muted-foreground">No tags yet — automations add tags as people interact.</span>}
              {tags?.data.map((tag) => {
                const selected = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setTagIds(selected ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id])}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      selected ? "border-brand bg-brand text-white" : "hover:border-brand/40",
                    )}
                  >
                    {tag.name}
                    {tag.contacts_count !== undefined && <span className={cn("ml-1", selected ? "text-white/70" : "text-muted-foreground")}>{tag.contacts_count}</span>}
                  </button>
                );
              })}
            </div>
          </FormField>
          <ConsentNote />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={pending || !templateId || !name.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create campaign
          </Button>
        </DialogFooter>
    </>
  );
}

export function SendCampaignDialog(props: React.ComponentProps<typeof SendCampaignDialogBody>) {
  return (
    <Dialog open={props.campaign !== null} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <SendCampaignDialogBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function SendCampaignDialogBody({
  campaign,
  onOpenChange,
  onSent,
}: {
  campaign: EmailCampaign | null;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}) {
  const { data: audience, isLoading } = useSWR<{ eligible: number; note: string }>(campaign ? `email/campaigns/${campaign.id}/audience` : null);
  const [mode, setMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [pending, setPending] = useState(false);

  async function send() {
    if (!campaign) return;
    setPending(true);
    try {
      await api.post(`email/campaigns/${campaign.id}/send`, mode === "later" && scheduledAt ? { scheduled_at: new Date(scheduledAt).toISOString() } : {});
      toast.success(mode === "later" ? "Campaign scheduled" : "Campaign is sending");
      onSent();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>Send “{campaign?.name}”</DialogTitle>
          <DialogDescription>Review the audience before sending. This cannot be undone.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Users className="size-5" />
          </span>
          <div>
            <div className="text-2xl font-semibold tabular-nums">{isLoading ? <Loader2 className="size-5 animate-spin" /> : (audience?.eligible ?? 0)}</div>
            <div className="text-xs text-muted-foreground">eligible recipients</div>
          </div>
        </div>
        {audience && <p className="text-xs text-muted-foreground">{audience.note}</p>}
        {audience?.eligible === 0 && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            Nobody is eligible yet. Collect emails with consent (for example with the “Collect email” step) before sending.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["now", "Send now", Send],
              ["later", "Schedule", CalendarClock],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn("flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors", mode === value ? "border-brand bg-brand-soft/50 text-brand" : "hover:bg-muted")}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        {mode === "later" && (
          <FormField label="Send at" htmlFor="cp-at" hint="Uses your browser's time zone.">
            <Input id="cp-at" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} min={new Date().toISOString().slice(0, 16)} />
          </FormField>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={send} disabled={pending || !audience?.eligible || (mode === "later" && !scheduledAt)}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {mode === "later" ? "Schedule campaign" : `Send to ${audience?.eligible ?? 0}`}
          </Button>
        </DialogFooter>
    </>
  );
}

export function ConsentNote({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border border-success/20 bg-success/5 p-3 text-xs text-muted-foreground", className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
      <span>
        <span className="font-medium text-foreground">Consent-first sending.</span> Campaigns only reach contacts with an email address, recorded marketing consent and no unsubscribe. Every email includes a one-click unsubscribe link.
      </span>
    </div>
  );
}
