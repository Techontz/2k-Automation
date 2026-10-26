"use client";

import { useState } from "react";
import useSWR from "swr";
import { Film, Image as ImageIcon, Loader2, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/app/platform-icon";
import { SimulatedBadge, StatusBadge } from "@/components/app/status-badge";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Channel, Post } from "@/lib/types";

export function ChannelRow({ channel, canManage, onChanged }: { channel: Channel; canManage: boolean; onChanged: () => void }) {
  const [postsOpen, setPostsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [now] = useState(Date.now);

  async function sync() {
    setSyncing(true);
    try {
      const result = await api.post<{ synced: number }>(`channels/${channel.id}/posts/sync`);
      toast.success(`Synced ${result.synced} posts.`);
      onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    try {
      await api.delete(`channels/${channel.id}`);
      toast.success(`${channel.name} disconnected.`);
      onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const expiresSoon = channel.token_expires_at && new Date(channel.token_expires_at).getTime() - now < 7 * 86400000;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PlatformIcon platform={channel.platform} className="size-9 rounded-xl" />
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-sm font-semibold">
            {channel.name}
            {channel.is_simulated && <SimulatedBadge />}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {channel.username ? `@${channel.username} · ` : ""}
            {channel.platform_label}
          </p>
          {channel.status_reason && <p className="mt-0.5 text-xs text-warning">{channel.status_reason}</p>}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-4 text-xs sm:w-[340px]">
        <div>
          <dt className="text-muted-foreground">Last webhook</dt>
          <dd className="mt-0.5 font-medium">{channel.last_webhook_at ? timeAgo(channel.last_webhook_at) : "Never"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Token</dt>
          <dd className={expiresSoon ? "mt-0.5 font-medium text-warning" : "mt-0.5 font-medium"}>
            {channel.is_simulated ? "n/a" : channel.token_expires_at ? `expires ${timeAgo(channel.token_expires_at)}` : "No expiry"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Posts</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{channel.posts_count ?? 0}</dd>
        </div>
      </dl>

      <div className="flex items-center gap-2">
        <StatusBadge status={channel.status} />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Channel actions" />}>
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setPostsOpen(true)}>
              <ImageIcon className="size-3.5" /> View posts
            </DropdownMenuItem>
            {!channel.is_simulated && channel.capabilities.comment_reply && (
              <DropdownMenuItem onClick={sync} disabled={syncing || channel.status !== "connected"}>
                <RefreshCw className="size-3.5" /> Sync posts
              </DropdownMenuItem>
            )}
            {canManage && !channel.is_simulated && channel.status !== "disconnected" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
                  <Trash2 className="size-3.5" /> Disconnect
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {channel.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Automations stop running for this account and its access token is deleted. Contacts and conversation history are kept. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={disconnect}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={postsOpen} onOpenChange={setPostsOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Posts · {channel.name}</SheetTitle>
            <SheetDescription>Posts and Reels available for keyword targeting.</SheetDescription>
          </SheetHeader>
          {postsOpen && <PostList channelId={channel.id} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PostList({ channelId }: { channelId: number }) {
  const { data } = useSWR<{ data: Post[] }>(`channels/${channelId}/posts`);

  if (!data) {
    return (
      <div className="space-y-3 px-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16" />)}
      </div>
    );
  }

  if (data.data.length === 0) {
    return <p className="px-4 text-sm text-muted-foreground">No posts yet. Use “Sync posts” to import recent media.</p>;
  }

  return (
    <ul className="space-y-2 overflow-y-auto px-4 pb-4">
      {data.data.map((post) => (
        <li key={post.id} className="flex gap-3 rounded-lg border p-2.5">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
            {post.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.thumbnail_url} alt="" className="size-full object-cover" />
            ) : post.media_type === "reel" || post.media_type === "video" ? (
              <Film className="size-4" />
            ) : (
              <ImageIcon className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm">{post.caption || <span className="text-muted-foreground">No caption</span>}</p>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">
              {post.media_type} · {post.published_at ? timeAgo(post.published_at) : "unknown date"}
              {post.permalink && (
                <>
                  {" · "}
                  <a href={post.permalink} target="_blank" rel="noreferrer" className="text-brand hover:underline">Open</a>
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
