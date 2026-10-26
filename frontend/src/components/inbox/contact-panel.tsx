"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock, Mail, Phone, Tag as TagIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PLATFORM_LABELS } from "@/components/app/platform-icon";
import { timeAgo } from "@/lib/format";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "./contact-avatar";

export function ContactPanel({ conversation }: { conversation: Conversation }) {
  const contact = conversation.contact;
  const [now] = useState(() => Date.now());
  if (!contact) return null;

  const windowOpen = contact.messaging_window_open;
  const closesAt = contact.last_inbound_at ? new Date(new Date(contact.last_inbound_at).getTime() + 24 * 3600 * 1000) : null;
  const hoursLeft = closesAt ? Math.max(0, Math.round((closesAt.getTime() - now) / 3600000)) : 0;

  return (
    <div className="h-full overflow-y-auto p-5 scrollbar-thin">
      <div className="flex flex-col items-center text-center">
        <ContactAvatar name={contact.display_name} platform={contact.platform} className="size-14 [&>span:first-child]:text-base" />
        <p className="mt-3 font-semibold">{contact.display_name}</p>
        {contact.username && <p className="text-xs text-muted-foreground">@{contact.username}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{PLATFORM_LABELS[contact.platform]}</p>
      </div>

      <div className={cn("mt-5 rounded-lg border px-3 py-2.5 text-xs", windowOpen ? "border-success/30 bg-success/5" : "bg-muted/50")}>
        <p className="flex items-center gap-1.5 font-medium">
          <Clock className={cn("size-3.5", windowOpen ? "text-success" : "text-muted-foreground")} />
          {windowOpen ? "Messaging window open" : "Messaging window closed"}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {windowOpen
            ? `About ${hoursLeft}h left to reply freely.`
            : contact.last_inbound_at
              ? `Last message ${timeAgo(contact.last_inbound_at)}.`
              : "They haven't messaged you yet."}
        </p>
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex items-center gap-2.5">
          <Mail className="size-3.5 text-muted-foreground" />
          <dd className="truncate">{contact.email ?? <span className="text-muted-foreground">No email</span>}</dd>
        </div>
        <div className="flex items-center gap-2.5">
          <Phone className="size-3.5 text-muted-foreground" />
          <dd className="truncate">{contact.phone ?? <span className="text-muted-foreground">No phone</span>}</dd>
        </div>
        <div className="flex items-start gap-2.5">
          <TagIcon className="mt-1 size-3.5 text-muted-foreground" />
          <dd className="flex flex-wrap gap-1">
            {contact.tags?.length ? (
              contact.tags.map((tag) => (
                <span key={tag.id} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                  {tag.name}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">No tags</span>
            )}
          </dd>
        </div>
      </dl>

      {Object.keys(contact.custom_fields ?? {}).length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">Custom fields</p>
          <dl className="space-y-1.5 text-xs">
            {Object.entries(contact.custom_fields).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="truncate font-medium">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <Link href={`/contacts?contact=${contact.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-6 w-full")}>
        Open full profile
      </Link>
    </div>
  );
}
