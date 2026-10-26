"use client";

import { useState } from "react";
import { Heart, Loader2, MessageCircle, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { timeAgo } from "@/lib/format";
import type { Message, Post } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { SimTimeline } from "./types";

const PRESETS = ["LINK", "CLAUDE", "GUIDE", "PRICE"];

/**
 * Instagram-style post with its comment thread. Public replies from the
 * engine are interleaved chronologically under the person's comments.
 */
export function PhoneMock({
  posts,
  postId,
  onPostChange,
  username,
  accountName,
  timeline,
  pending,
  onComment,
}: {
  posts: Post[];
  postId: number | null;
  onPostChange: (id: number) => void;
  username: string;
  accountName: string;
  timeline: SimTimeline | null;
  pending: boolean;
  onComment: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const post = posts.find((item) => item.id === postId) ?? posts[0];

  const thread = [
    ...(timeline?.comments ?? []).map((comment) => ({ type: "comment" as const, at: comment.created_at, id: `c${comment.id}`, text: comment.text, keyword: comment.matched_keyword })),
    ...(timeline?.messages ?? [])
      .filter((message: Message) => message.kind === "comment_reply")
      .map((message) => ({ type: "reply" as const, at: message.created_at, id: `m${message.id}`, text: message.body ?? "", status: message.status })),
  ].sort((a, b) => a.at.localeCompare(b.at) || (a.type === "comment" ? -1 : 1));

  function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed || pending) return;
    onComment(trimmed);
    setText("");
  }

  return (
    <div className="overflow-hidden rounded-[1.6rem] border bg-card shadow-[0_8px_30px_-12px_rgba(20,20,40,0.18)]">
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[2px]">
          <span className="flex size-full items-center justify-center rounded-full bg-card text-[0.6rem] font-semibold">2K</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{accountName}</p>
          <p className="text-[0.7rem] text-muted-foreground">Test account</p>
        </div>
        <select
          aria-label="Choose post"
          className="max-w-[9.5rem] truncate rounded-md border bg-background px-2 py-1 text-xs"
          value={post?.id ?? ""}
          onChange={(event) => onPostChange(Number(event.target.value))}
        >
          {posts.map((item, index) => (
            <option key={item.id} value={item.id}>
              {item.media_type === "reel" ? "Reel" : "Post"} {index + 1}
            </option>
          ))}
        </select>
      </div>

      <div className="relative flex aspect-[4/3] items-end bg-gradient-to-br from-[#2a1d6e] via-[#5b3df5] to-[#a78bfa] p-4 text-white">
        {post?.media_type === "reel" && (
          <span className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <Play className="size-5 fill-white" />
          </span>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide">{post?.media_type ?? "post"}</span>
        <p className="line-clamp-2 text-sm font-medium drop-shadow">{post?.caption}</p>
      </div>

      <div className="flex items-center gap-4 px-4 pt-3 text-foreground">
        <Heart className="size-5" />
        <MessageCircle className="size-5" />
        <Send className="size-5" />
      </div>

      <div className="max-h-[260px] min-h-[120px] space-y-3 overflow-y-auto px-4 py-3 scrollbar-thin">
        {thread.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No comments yet. Try one of the keywords below.</p>}
        {thread.map((item) =>
          item.type === "comment" ? (
            <div key={item.id} className="animate-in-up text-sm">
              <span className="font-semibold">{username}</span> {item.text}
              {item.keyword && <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[0.65rem] font-medium text-brand">matched “{item.keyword}”</span>}
              <div className="text-[0.7rem] text-muted-foreground">{timeAgo(item.at)}</div>
            </div>
          ) : (
            <div key={item.id} className="animate-in-up ml-6 border-l-2 border-brand/30 pl-3 text-sm">
              <span className="font-semibold">{accountName}</span> {item.text}
              <div className={cn("text-[0.7rem]", item.status === "sent" ? "text-muted-foreground" : "text-warning")}>
                {item.status === "sent" ? "Public reply · automated" : `Reply ${item.status}`}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="border-t px-3 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={pending}
              onClick={() => submit(preset)}
              className="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
            >
              {preset}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(text);
          }}
        >
          <Input value={text} onChange={(event) => setText(event.target.value)} placeholder={`Comment as @${username}…`} maxLength={500} className="h-9" />
          <Button type="submit" size="sm" disabled={pending || !text.trim()} className="h-9">
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Post"}
          </Button>
        </form>
      </div>
    </div>
  );
}
