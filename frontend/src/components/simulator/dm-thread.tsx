"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { timeAgo } from "@/lib/format";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Partial<Record<Message["kind"], string>> = {
  private_reply: "Private reply",
  template: "Template",
};

/** The simulated person's DM inbox with the business account. */
export function DmThread({
  username,
  accountName,
  messages,
  pending,
  onSend,
}: {
  username: string;
  accountName: string;
  messages: Message[];
  pending: boolean;
  onSend: (text: string, storyReply: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [storyReply, setStoryReply] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const dms = messages.filter((message) => message.kind !== "comment_reply" && message.kind !== "comment");

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [dms.length]);

  return (
    <div className="overflow-hidden rounded-[1.6rem] border bg-card shadow-[0_8px_30px_-12px_rgba(20,20,40,0.18)]">
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-[0.65rem] font-semibold text-brand">2K</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{accountName}</p>
          <p className="text-[0.7rem] text-muted-foreground">Direct messages · viewing as @{username}</p>
        </div>
      </div>

      <div ref={scroller} className="h-[300px] space-y-2.5 overflow-y-auto bg-muted/30 px-4 py-4 scrollbar-thin">
        {dms.length === 0 && (
          <p className="pt-20 text-center text-xs text-muted-foreground">No messages yet. Automated DMs and private replies will appear here.</p>
        )}
        {dms.map((message) => {
          const mine = message.direction === "in";
          const buttons = message.payload?.buttons ?? [];
          return (
            <div key={message.id} className={cn("flex animate-in-up flex-col", mine ? "items-end" : "items-start")}>
              {!mine && KIND_LABEL[message.kind] && (
                <span className="mb-0.5 px-1 text-[0.65rem] font-medium text-brand">{KIND_LABEL[message.kind]}</span>
              )}
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                  mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border bg-card",
                  message.status === "blocked" && "border-dashed border-warning/60 opacity-70",
                  message.status === "failed" && "border-dashed border-destructive/60 opacity-70",
                )}
              >
                {message.body}
                {buttons.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {buttons.map((button) => (
                      <a
                        key={button.url + button.title}
                        href={button.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-muted"
                      >
                        {button.title}
                        <ExternalLink className="size-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <span className="mt-0.5 px-1 text-[0.65rem] text-muted-foreground">
                {message.status === "blocked" || message.status === "failed"
                  ? `Not delivered — ${message.error_message ?? message.status}`
                  : `${mine ? "You" : message.source === "ai" ? "AI assistant" : message.source === "user" ? "Team" : "Automation"} · ${timeAgo(message.created_at)}`}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t px-3 py-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = text.trim();
            if (!trimmed || pending) return;
            onSend(trimmed, storyReply);
            setText("");
          }}
        >
          <Input value={text} onChange={(event) => setText(event.target.value)} placeholder={storyReply ? "Reply to story…" : "Message…"} maxLength={1000} className="h-9" />
          <Button type="submit" size="icon" className="size-9" disabled={pending || !text.trim()} aria-label="Send message">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          </Button>
        </form>
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Switch size="sm" checked={storyReply} onCheckedChange={setStoryReply} />
          Send as a reply to your story
        </label>
      </div>
    </div>
  );
}
