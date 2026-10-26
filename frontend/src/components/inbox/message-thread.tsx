"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  ArrowLeft,
  Bot,
  BotOff,
  CheckCircle2,
  Info,
  Loader2,
  MoreHorizontal,
  PanelRight,
  RotateCcw,
  Send,
  Sparkles,
  UserCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SimulatedBadge, StatusBadge } from "@/components/app/status-badge";
import { useCan, useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import type { Conversation, Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "./contact-avatar";
import { MessageBubble } from "./message-bubble";

export interface ThreadResponse {
  conversation: Conversation;
  messages: Message[];
  reply_policy: { allowed: boolean; mode: string; reason: string | null };
}

interface Suggestion {
  suggestion: string;
  confidence: number;
  language: string;
  handover: boolean;
  reason: string | null;
  provider: string;
}

interface TeamResponse {
  members: { id: number; name: string; email: string; role: string }[];
}

export function MessageThread({
  conversationId,
  onBack,
  onToggleDetails,
}: {
  conversationId: number;
  onBack: () => void;
  onToggleDetails: () => void;
}) {
  const key = `conversations/${conversationId}`;
  const { data, isLoading, mutate } = useSWR<ThreadResponse>(key, { refreshInterval: 5000 });
  const { mutate: globalMutate } = useSWRConfig();
  const { user } = useSession();
  const canReply = useCan("inbox.reply");
  const { data: team } = useSWR<TeamResponse>(canReply ? "team" : null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCount = data?.messages.length ?? 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messageCount, conversationId]);

  const refreshLists = () => globalMutate((cacheKey) => typeof cacheKey === "string" && cacheKey.startsWith("conversations?"));

  async function update(patch: Record<string, unknown>, success: string) {
    try {
      await api.patch(key, patch);
      await mutate();
      refreshLists();
      toast.success(success);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const response = await api.post<{ data: Message }>(`${key}/messages`, { text });
      const sent = response.data;
      if (sent.status === "blocked" || sent.status === "failed") {
        toast.error(sent.error_message ?? "The message could not be sent.");
      } else {
        setDraft("");
        setSuggestion(null);
      }
      await mutate();
      refreshLists();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function suggest() {
    setSuggesting(true);
    try {
      const result = await api.post<Suggestion>(`${key}/suggest`);
      setSuggestion(result);
      if (result.suggestion) setDraft(result.suggestion);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center gap-3 border-b px-4">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex-1 space-y-3 p-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="ml-auto h-10 w-1/2" />
          <Skeleton className="h-10 w-1/3" />
        </div>
      </div>
    );
  }

  const { conversation, messages, reply_policy: policy } = data;
  const name = conversation.contact?.display_name ?? "Unknown contact";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} aria-label="Back to conversations">
          <ArrowLeft className="size-4" />
        </Button>
        <ContactAvatar name={name} platform={conversation.channel?.platform} className="size-8" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            {conversation.is_simulated && <SimulatedBadge />}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.channel?.name}
            {conversation.assignee ? ` · Assigned to ${conversation.assignee.name}` : " · Unassigned"}
          </p>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          {conversation.needs_human && <StatusBadge status="needs_human" tone="warning" label="Needs human" />}
          {conversation.ai_paused && <StatusBadge status="ai_paused" tone="neutral" label="AI paused" />}
          {conversation.status !== "open" && <StatusBadge status={conversation.status} />}
        </div>
        {canReply && (
          <>
            {conversation.status === "open" ? (
              <Button variant="outline" size="sm" onClick={() => update({ status: "closed" }, "Conversation closed")}>
                <CheckCircle2 className="size-3.5" /> <span className="hidden sm:inline">Close</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => update({ status: "open" }, "Conversation reopened")}>
                <RotateCcw className="size-3.5" /> <span className="hidden sm:inline">Reopen</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                  {user && (
                    <DropdownMenuItem onClick={() => update({ assigned_user_id: user.id }, "Assigned to you")}>
                      <UserCheck className="size-3.5" /> Me
                    </DropdownMenuItem>
                  )}
                  {team?.members
                    .filter((member) => member.id !== user?.id)
                    .map((member) => (
                      <DropdownMenuItem key={member.id} onClick={() => update({ assigned_user_id: member.id }, `Assigned to ${member.name}`)}>
                        <UserRound className="size-3.5" /> {member.name}
                      </DropdownMenuItem>
                    ))}
                  {conversation.assignee && (
                    <DropdownMenuItem onClick={() => update({ assigned_user_id: null }, "Unassigned")}>Unassign</DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {conversation.ai_paused ? (
                  <DropdownMenuItem onClick={() => update({ ai_paused: false }, "AI replies resumed")}>
                    <Bot className="size-3.5" /> Resume AI replies
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => update({ ai_paused: true }, "AI replies paused")}>
                    <BotOff className="size-3.5" /> Pause AI replies
                  </DropdownMenuItem>
                )}
                {conversation.needs_human && (
                  <DropdownMenuItem onClick={() => update({ needs_human: false }, "Marked as handled")}>
                    <CheckCircle2 className="size-3.5" /> Mark as handled
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        <Button variant="ghost" size="icon-sm" className="hidden xl:inline-flex" onClick={onToggleDetails} aria-label="Toggle contact details">
          <PanelRight className="size-4" />
        </Button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background/60 px-3 py-5 scrollbar-thin sm:px-6">
        {messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No messages in this conversation yet.</p>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
      </div>

      {canReply && (
        <div className="shrink-0 border-t bg-card p-3">
          {!policy.allowed ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="font-medium">You can&apos;t message this person right now</p>
                <p className="text-xs text-muted-foreground">{policy.reason}</p>
              </div>
            </div>
          ) : (
            <>
              {policy.mode === "human_agent" && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="size-3.5 text-brand" />
                  Outside the 24-hour window — your reply is sent with the Human Agent tag (allowed for 7 days, human-written replies only).
                </p>
              )}
              {suggestion && (
                <div className={cn("mb-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs", suggestion.handover ? "bg-warning/10 text-warning" : "bg-brand-soft text-accent-foreground")}>
                  <Sparkles className="mt-0.5 size-3.5 shrink-0" />
                  <span className="flex-1">
                    {suggestion.handover
                      ? `AI suggests a human answers this: ${suggestion.reason ?? "low confidence"}`
                      : `AI draft inserted · ${Math.round(suggestion.confidence * 100)}% confident · ${suggestion.language.toUpperCase()} · ${suggestion.provider}`}
                  </span>
                  <button className="font-medium underline-offset-2 hover:underline" onClick={() => setSuggestion(null)}>
                    Dismiss
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  placeholder={`Reply to ${name}…  (Enter to send, Shift+Enter for a new line)`}
                  rows={2}
                  maxLength={2000}
                  className="max-h-40 min-h-[44px] flex-1 resize-none"
                  aria-label="Message"
                />
                <div className="flex flex-col gap-1.5">
                  <Button variant="outline" size="sm" onClick={suggest} disabled={suggesting} title="Draft a reply with AI">
                    {suggesting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                    <span className="hidden sm:inline">AI suggest</span>
                  </Button>
                  <Button size="sm" onClick={send} disabled={sending || !draft.trim()}>
                    {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
