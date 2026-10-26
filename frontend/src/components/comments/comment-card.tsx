"use client";

import { useState } from "react";
import { CheckCircle2, CircleDashed, Clapperboard, Image as ImageIcon, Loader2, Lock, Reply, Send, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SimulatedBadge } from "@/components/app/status-badge";
import { ContactAvatar } from "@/components/inbox/contact-avatar";
import { useCan } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { dateTime, timeAgo } from "@/lib/format";
import type { Message, Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface CommentRow {
  id: number;
  text: string;
  matched_keyword: string | null;
  is_simulated: boolean;
  parent_external_id: string | null;
  commented_at: string;
  public_replied_at: string | null;
  private_replied_at: string | null;
  private_reply_available: boolean;
  private_reply_expires_at: string;
  contact: { id: number; username: string | null; name: string | null } | null;
  post: { id: number; caption: string | null; media_type: string; permalink: string | null } | null;
  channel: { id: number; name: string; platform: Platform; is_simulated: boolean } | null;
}

const MEDIA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  reel: Clapperboard,
  video: Video,
  post: ImageIcon,
};

function privateReplyLabel(comment: CommentRow, now: number): { text: string; tone: "success" | "brand" | "muted" } {
  if (comment.private_replied_at) return { text: `Private reply sent ${timeAgo(comment.private_replied_at)}`, tone: "success" };
  if (!comment.private_reply_available) return { text: "Private reply window closed", tone: "muted" };
  const msLeft = new Date(comment.private_reply_expires_at).getTime() - now;
  const days = Math.floor(msLeft / 86400000);
  const hours = Math.max(1, Math.floor(msLeft / 3600000));
  return { text: days >= 1 ? `Private reply available for ${days} more day${days === 1 ? "" : "s"}` : `Private reply available for ${hours} more hour${hours === 1 ? "" : "s"}`, tone: "brand" };
}

export function CommentCard({ comment, onReplied }: { comment: CommentRow; onReplied: () => void }) {
  const canReply = useCan("inbox.reply");
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [now] = useState(Date.now);
  const author = comment.contact?.username ? `@${comment.contact.username}` : comment.contact?.name ?? "Unknown";
  const MediaIcon = MEDIA_ICONS[comment.post?.media_type ?? "post"] ?? ImageIcon;
  const privateStatus = privateReplyLabel(comment, now);

  async function send() {
    setPending(true);
    try {
      const response = await api.post<{ data: Message }>(`comments/${comment.id}/reply`, { text });
      if (response.data.status === "blocked" || response.data.status === "failed") {
        toast.error(response.data.error_message ?? "Reply could not be posted.");
      } else {
        toast.success("Reply posted");
        setReplying(false);
        setText("");
      }
      onReplied();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="animate-in-up rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <ContactAvatar name={author} platform={comment.channel?.platform} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold">{author}</span>
            <span className="text-xs text-muted-foreground" title={dateTime(comment.commented_at)}>
              {timeAgo(comment.commented_at)}
            </span>
            {comment.parent_external_id && <span className="text-xs text-muted-foreground">· reply in thread</span>}
            {comment.is_simulated && <SimulatedBadge />}
            {comment.matched_keyword && (
              <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[0.68rem] font-semibold text-brand">Keyword: {comment.matched_keyword}</span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">{comment.text}</p>

          {comment.post && (
            <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
              <MediaIcon className="size-3.5 shrink-0" />
              <span className="shrink-0 font-medium capitalize text-foreground">{comment.post.media_type}</span>
              <span className="truncate">{comment.post.caption ?? "Untitled post"}</span>
              {comment.post.permalink && (
                <a href={comment.post.permalink} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0 font-medium text-brand hover:underline">
                  View
                </a>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <span className={cn("inline-flex items-center gap-1.5", comment.public_replied_at ? "text-success" : "text-muted-foreground")}>
              {comment.public_replied_at ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />}
              {comment.public_replied_at ? `Replied publicly ${timeAgo(comment.public_replied_at)}` : "No public reply"}
            </span>
            {comment.channel && comment.channel.platform !== "tiktok" && (
              <span className={cn("inline-flex items-center gap-1.5", privateStatus.tone === "success" ? "text-success" : privateStatus.tone === "brand" ? "text-brand" : "text-muted-foreground")}>
                <Lock className="size-3.5" />
                {privateStatus.text}
              </span>
            )}
            {canReply && !replying && (
              <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setReplying(true)}>
                <Reply className="size-3" /> Reply publicly
              </Button>
            )}
          </div>

          {replying && (
            <div className="mt-3 flex items-end gap-2">
              <Textarea
                autoFocus
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={`Reply to ${author} publicly…`}
                rows={2}
                maxLength={2000}
                className="min-h-[44px] flex-1 resize-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && text.trim()) {
                    event.preventDefault();
                    send();
                  }
                  if (event.key === "Escape") setReplying(false);
                }}
              />
              <div className="flex flex-col gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setReplying(false)}>Cancel</Button>
                <Button size="sm" onClick={send} disabled={pending || !text.trim()}>
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Post
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
