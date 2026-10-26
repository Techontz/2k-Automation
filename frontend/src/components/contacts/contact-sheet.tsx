"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Check, Loader2, MessageSquare, Trash2, Workflow, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PLATFORM_LABELS } from "@/components/app/platform-icon";
import { SimulatedBadge, StatusBadge } from "@/components/app/status-badge";
import { ContactAvatar } from "@/components/inbox/contact-avatar";
import { useCan } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { dateTime, timeAgo } from "@/lib/format";
import type { Contact, Message, Run } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CONSENT_LABELS, ConsentDialog } from "./consent-dialog";
import { TagEditor } from "./tag-editor";

interface ContactDetail {
  contact: Contact;
  consents: { id: number; type: string; status: "granted" | "revoked"; source: string; evidence: string | null; recorded_at: string }[];
  consent_state: Record<string, boolean>;
  recent_messages: Message[];
  runs: (Pick<Run, "id" | "automation_id" | "status" | "started_at" | "finished_at"> & { automation?: { id: number; name: string } })[];
}

export function ContactSheet({ contactId, onClose, onChanged }: { contactId: number | null; onClose: () => void; onChanged: () => void }) {
  const { data, mutate } = useSWR<ContactDetail>(contactId ? `contacts/${contactId}` : null);
  const canEdit = useCan("contacts.edit");
  const canErase = useCan("settings.manage");
  const contact = data?.contact;

  async function erase() {
    if (!contact) return;
    try {
      await api.delete(`contacts/${contact.id}`);
      toast.success("Contact and their data were erased");
      onChanged();
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <Sheet open={contactId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg data-[side=right]:sm:max-w-lg">
        {!contact ? (
          <div className="space-y-4 p-6">
            <SheetTitle className="sr-only">Loading contact</SheetTitle>
            <Skeleton className="size-14 rounded-full" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b p-6">
              <div className="flex items-center gap-4">
                <ContactAvatar name={contact.display_name} platform={contact.platform} className="size-12" />
                <div className="min-w-0">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <span className="truncate">{contact.display_name}</span>
                    {contact.is_simulated && <SimulatedBadge />}
                  </SheetTitle>
                  <SheetDescription>
                    {PLATFORM_LABELS[contact.platform]}
                    {contact.username ? ` · @${contact.username}` : ""} · added {timeAgo(contact.created_at)}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-7 p-6">
              <ProfileForm
                key={contact.id}
                contact={contact}
                canEdit={canEdit}
                onSaved={async () => {
                  await mutate();
                  onChanged();
                }}
              />

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consent</h3>
                  {canEdit && <ConsentDialog contactId={contact.id} onSaved={() => mutate()} />}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {Object.entries(data.consent_state).map(([type, granted]) => (
                    <div key={type} className={cn("rounded-lg border px-3 py-2", granted && "border-success/30 bg-success/5")}>
                      <p className="text-[0.7rem] text-muted-foreground">{CONSENT_LABELS[type] ?? type}</p>
                      <p className={cn("mt-0.5 flex items-center gap-1 text-sm font-medium", granted ? "text-success" : "text-muted-foreground")}>
                        {granted ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                        {granted ? "Granted" : "None"}
                      </p>
                    </div>
                  ))}
                </div>
                {data.consents.length > 0 && (
                  <ol className="relative space-y-3 border-l pl-4">
                    {data.consents.map((consent) => (
                      <li key={consent.id} className="relative">
                        <span className={cn("absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-popover", consent.status === "granted" ? "bg-success" : "bg-destructive")} />
                        <p className="text-sm">
                          <span className="font-medium capitalize">{consent.status}</span> · {CONSENT_LABELS[consent.type] ?? consent.type}
                          <span className="text-muted-foreground"> via {consent.source.replace(/_/g, " ")}</span>
                        </p>
                        {consent.evidence && <p className="mt-0.5 text-xs text-muted-foreground">{consent.evidence}</p>}
                        <p className="text-[0.68rem] text-muted-foreground">{dateTime(consent.recorded_at)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent messages</h3>
                {data.recent_messages.length ? (
                  <ul className="divide-y rounded-lg border">
                    {data.recent_messages.slice(0, 8).map((message) => (
                      <li key={message.id} className="flex items-start gap-2.5 px-3 py-2">
                        <MessageSquare className={cn("mt-0.5 size-3.5 shrink-0", message.direction === "in" ? "text-muted-foreground" : "text-brand")} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{message.body ?? "(attachment)"}</p>
                          <p className="text-[0.68rem] text-muted-foreground">
                            {message.direction === "in" ? "Received" : message.kind.replace(/_/g, " ")} · {timeAgo(message.created_at)}
                          </p>
                        </div>
                        {message.direction === "out" && <StatusBadge status={message.status} />}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                )}
                {data.recent_messages.some((message) => message.conversation_id) && (
                  <Link href={`/inbox?c=${data.recent_messages.find((message) => message.conversation_id)?.conversation_id}`} className="inline-block text-xs font-medium text-brand hover:underline">
                    Open conversation →
                  </Link>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Automation runs</h3>
                {data.runs.length ? (
                  <ul className="divide-y rounded-lg border">
                    {data.runs.map((run) => (
                      <li key={run.id} className="flex items-center gap-2.5 px-3 py-2">
                        <Workflow className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate text-sm">{run.automation?.name ?? `Automation #${run.automation_id}`}</span>
                        <span className="text-[0.68rem] text-muted-foreground">{timeAgo(run.started_at)}</span>
                        <StatusBadge status={run.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No automations have run for this contact.</p>
                )}
              </section>

              {canErase && (
                <section className="rounded-lg border border-destructive/30 p-4">
                  <h3 className="text-sm font-semibold">Erase contact</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Permanently deletes this contact, their messages and comments (GDPR right to erasure). This cannot be undone.</p>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="destructive" size="sm" className="mt-3" />}>
                      <Trash2 className="size-3.5" /> Erase all data
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Erase {contact.display_name}?</AlertDialogTitle>
                        <AlertDialogDescription>All of their data — profile, messages, comments and tags — will be permanently deleted. An audit log entry is kept.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={erase}>Erase permanently</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProfileForm({ contact, canEdit, onSaved }: { contact: Contact; canEdit: boolean; onSaved: () => Promise<void> }) {
  const savedTags = contact.tags?.map((tag) => tag.name) ?? [];
  const [form, setForm] = useState({ name: contact.name ?? "", email: contact.email ?? "", phone: contact.phone ?? "", unsubscribed: contact.unsubscribed });
  const [tags, setTags] = useState<string[]>(savedTags);
  const [saving, setSaving] = useState(false);

  const dirty =
    form.name !== (contact.name ?? "") ||
    form.email !== (contact.email ?? "") ||
    form.phone !== (contact.phone ?? "") ||
    form.unsubscribed !== contact.unsubscribed ||
    tags.join("|") !== savedTags.join("|");

  async function save() {
    setSaving(true);
    try {
      await api.patch(`contacts/${contact.id}`, {
        name: form.name || null,
        email: form.email || null,
        phone: form.phone || null,
        unsubscribed: form.unsubscribed,
      });
      await api.put(`contacts/${contact.id}/tags`, { tags });
      await onSaved();
      toast.success("Contact updated");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input id="contact-name" value={form.name} disabled={!canEdit} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" type="email" value={form.email} disabled={!canEdit} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">Phone</Label>
          <Input id="contact-phone" value={form.phone} disabled={!canEdit} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Tags</Label>
        <TagEditor value={tags} onChange={setTags} disabled={!canEdit} />
      </div>
      <label className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
        <span>
          <span className="block text-sm font-medium">Opted out of messages</span>
          <span className="block text-xs text-muted-foreground">Automations and teammates will not message this contact.</span>
        </span>
        <Switch checked={form.unsubscribed} disabled={!canEdit} onCheckedChange={(checked) => setForm({ ...form, unsubscribed: checked })} />
      </label>
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving && <Loader2 className="size-3.5 animate-spin" />} Save changes
          </Button>
        </div>
      )}
      {Object.keys(contact.custom_fields ?? {}).length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 p-3 text-xs">
          {Object.entries(contact.custom_fields).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="truncate font-medium">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
