"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { Activity, AlertTriangle, AtSign, FlaskConical, Play, RotateCcw, Tag, UserRound, Workflow } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { useCan } from "@/hooks/use-session";
import { api, qs } from "@/lib/api";
import type { Automation, Run } from "@/lib/types";
import { DmThread } from "./dm-thread";
import { PhoneMock } from "./phone-mock";
import { RunTimeline } from "./run-timeline";
import type { SimState, SimTimeline } from "./types";

export function SimulatorView() {
  const params = useSearchParams();
  const automationId = params.get("automation");
  const canSimulate = useCan("simulate");

  const { data: state, isLoading } = useSWR<SimState>("simulator");
  const { data: automation, mutate: mutateAutomation } = useSWR<{ data: Automation }>(automationId ? `automations/${automationId}` : null);

  const [username, setUsername] = useState("amina.k");
  const [postId, setPostId] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<SimTimeline | null>(null);
  const [pending, setPending] = useState<"comment" | "message" | null>(null);
  const [fastForwarding, setFastForwarding] = useState(false);

  const handle = username.trim().replace(/^@/, "") || "test.user";

  const refresh = useCallback(async () => {
    try {
      setTimeline(await api.get<SimTimeline>(`simulator/conversation${qs({ username: handle })}`));
    } catch {
      setTimeline(null);
    }
  }, [handle]);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 300);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function comment(text: string) {
    setPending("comment");
    try {
      const result = await api.post<SimTimeline>("simulator/comment", { username: handle, text, post_id: postId ?? state?.posts[0]?.id });
      setTimeline(result);
      if (!result.runs.length) toast.info("Comment stored — no active automation matched it.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function message(text: string, storyReply: boolean) {
    setPending("message");
    try {
      setTimeline(await api.post<SimTimeline>("simulator/message", { username: handle, text, story_reply: storyReply }));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function fastForward(run: Run) {
    setFastForwarding(true);
    try {
      await api.post(`simulator/runs/${run.id}/fast-forward`);
      await refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setFastForwarding(false);
    }
  }

  async function reset() {
    try {
      await api.post("simulator/reset");
      setTimeline(null);
      toast.success("Simulation data cleared.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function activate() {
    if (!automationId) return;
    try {
      await api.post(`automations/${automationId}/activate`);
      await mutateAutomation();
      toast.success("Automation activated.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const accountName = state?.channel.username ?? "yourbrand.sim";
  const tested = automation?.data;

  return (
    <>
      <PageHeader
        title="Simulator"
        description="Act as a follower: comment on a test Reel or send a DM, then watch your automations run step by step."
        actions={
          canSimulate && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="outline" />}>
                <RotateCcw className="size-4" /> Reset simulation
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset the simulation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes all simulated contacts, comments, messages and runs. Real data and your automations are not affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={reset}>Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-dashed border-warning/50 bg-warning/5 px-4 py-3">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="text-sm">
          <p className="font-semibold text-warning">Simulation mode — nothing is sent to Instagram</p>
          <p className="text-muted-foreground">
            Events go through the real pipeline (webhook normalisation, triggers, messaging policy) using a test account. Simulated records are labelled everywhere and excluded from analytics by default.
          </p>
        </div>
      </div>

      {tested && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><Workflow className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold">
              Testing: <Link href={`/automations/${tested.id}`} className="truncate hover:text-brand">{tested.name}</Link>
              <StatusBadge status={tested.status} />
            </p>
            <p className="text-xs text-muted-foreground">
              {tested.trigger_label}
              {tested.trigger_config.keywords?.length ? ` — try commenting “${tested.trigger_config.keywords[0]}”` : ""}
            </p>
          </div>
          {tested.status !== "active" && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3.5" /> Only active automations run</span>
              <Button size="sm" onClick={activate}><Play className="size-3.5" /> Activate</Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,400px)_1fr]">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="sim-username">Simulate as</Label>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="sim-username"
                value={username}
                onChange={(event) => setUsername(event.target.value.replace(/[^\w.@]/g, "").slice(0, 40))}
                className="h-9 pl-8"
              />
            </div>
            <p className="text-xs text-muted-foreground">Each username is a separate test contact with its own messaging window.</p>
          </div>

          {isLoading || !state ? (
            <Skeleton className="h-[560px] rounded-[1.6rem]" />
          ) : (
            <>
              <PhoneMock
                posts={state.posts}
                postId={postId}
                onPostChange={setPostId}
                username={handle}
                accountName={accountName}
                timeline={timeline}
                pending={pending === "comment" || !canSimulate}
                onComment={comment}
              />
              <DmThread username={handle} accountName={accountName} messages={timeline?.messages ?? []} pending={pending === "message" || !canSimulate} onSend={message} />
            </>
          )}
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Activity className="size-4 text-brand" /> What the engine did</h2>
            <Button variant="ghost" size="sm" onClick={refresh}>Refresh</Button>
          </div>

          {timeline?.contact && (
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoTile icon={UserRound} label="Contact" value={`@${timeline.contact.username ?? handle}`} />
              <InfoTile icon={AtSign} label="Email" value={timeline.contact.email ?? "Not collected"} muted={!timeline.contact.email} />
              <InfoTile icon={Tag} label="Tags" value={timeline.contact.tags.length ? timeline.contact.tags.join(", ") : "None"} muted={!timeline.contact.tags.length} />
            </div>
          )}

          {timeline?.event && (
            <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-xs">
              <span className="font-medium">Webhook event #{timeline.event.id}</span>
              <StatusBadge status={timeline.event.status} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{timeline.event.error ?? timeline.event.outcome}</span>
            </div>
          )}

          {timeline?.runs.length ? (
            timeline.runs.map((run) => <RunTimeline key={run.id} run={run} onFastForward={fastForward} fastForwarding={fastForwarding} />)
          ) : (
            <EmptyState
              icon={FlaskConical}
              title="Nothing has run yet"
              description="Post a comment with a keyword like LINK, or send a DM. Every step the engine takes will appear here."
              action={<Link href="/automations" className={buttonVariants({ variant: "outline", size: "sm" })}>View automations</Link>}
            />
          )}
        </div>
      </div>
    </>
  );
}

function InfoTile({ icon: Icon, label, value, muted }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border bg-card px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground"><Icon className="size-3" /> {label}</p>
      <p className={muted ? "mt-1 truncate text-sm text-muted-foreground" : "mt-1 truncate text-sm font-medium"}>{value}</p>
    </div>
  );
}
