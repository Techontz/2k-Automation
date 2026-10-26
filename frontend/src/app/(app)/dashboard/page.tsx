"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, Bot, FlaskConical, Inbox, MessageSquareText, Plug, Send, Sparkles, Users, Workflow } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityChart } from "@/components/charts/activity-chart";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PlatformIcon } from "@/components/app/platform-icon";
import { StatCard } from "@/components/app/stat-card";
import { SimulatedBadge, StatusBadge } from "@/components/app/status-badge";
import { useSession } from "@/hooks/use-session";
import { compact, delta, timeAgo } from "@/lib/format";
import type { Automation, Channel, Overview, Paginated, Run, TimeseriesPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useSession();
  const { data: overview } = useSWR<Overview>("analytics/overview?days=30&include_simulated=1");
  const { data: series } = useSWR<{ data: TimeseriesPoint[] }>("analytics/timeseries?days=30&include_simulated=1");
  const { data: channels } = useSWR<{ data: Channel[] }>("channels");
  const { data: automations } = useSWR<{ data: Automation[] }>("automations");
  const { data: runs } = useSWR<Paginated<Run>>("runs?per_page=6");

  const current = overview?.current;
  const previous = overview?.previous;
  const liveChannels = channels?.data.filter((channel) => !channel.is_simulated && channel.status === "connected") ?? [];
  const hasActivity = (series?.data ?? []).some((point) => point.sent + point.comments + point.received > 0);

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${user?.name?.split(" ")[0] ?? "there"}`}
        description="Here is how your automations performed over the last 30 days."
        actions={
          <>
            <Link href="/simulator" className={buttonVariants({ variant: "outline" })}>
              <FlaskConical className="size-4" /> Simulator
            </Link>
            <Link href="/automations?new=1" className={buttonVariants()}>
              <Workflow className="size-4" /> New automation
            </Link>
          </>
        }
      />

      {liveChannels.length === 0 && channels && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-brand/20 bg-brand-soft/60 p-4 sm:flex-row sm:items-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white"><Plug className="size-5" /></span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Connect your first account</p>
            <p className="text-sm text-muted-foreground">Until then, everything runs in simulation mode — try commenting &quot;LINK&quot; on a test Reel.</p>
          </div>
          <Link href="/channels" className={buttonVariants({ size: "sm" })}>Connect Instagram <ArrowRight className="size-3.5" /></Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {current && previous ? (
          <>
            <StatCard label="Comments processed" value={compact(current.comments_processed)} change={delta(current.comments_processed, previous.comments_processed)} icon={MessageSquareText} hint={`${current.keyword_matches} matched a keyword`} />
            <StatCard label="Messages sent" value={compact(current.messages_sent)} change={delta(current.messages_sent, previous.messages_sent)} icon={Send} hint={current.delivery_rate !== null ? `${current.delivery_rate}% delivery rate` : "No sends yet"} />
            <StatCard label="Contacts" value={compact(overview.totals.contacts)} change={delta(current.new_contacts, previous.new_contacts)} icon={Users} hint={`${current.leads_with_email} ${current.leads_with_email === 1 ? "lead" : "leads"} with email`} />
            <StatCard label="Active automations" value={overview.totals.active_automations} icon={Workflow} hint={`${current.runs} runs this period`} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[106px] rounded-xl" />)
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold">Engagement</h2>
              <p className="text-xs text-muted-foreground">Daily comments, messages received and messages sent</p>
            </div>
            <Link href="/analytics" className="text-xs font-medium text-brand hover:underline">View analytics</Link>
          </div>
          {!series ? (
            <Skeleton className="h-[280px]" />
          ) : hasActivity ? (
            <ActivityChart
              data={series.data}
              series={[
                { key: "sent", label: "Messages sent", color: "--chart-1" },
                { key: "received", label: "Messages received", color: "--chart-2" },
                { key: "comments", label: "Comments", color: "--chart-3" },
              ]}
            />
          ) : (
            <EmptyState className="h-[280px] border-none" icon={Sparkles} title="No activity yet" description="Run a simulation or connect a channel and your engagement will appear here." action={<Link href="/simulator" className={buttonVariants({ size: "sm" })}>Open simulator</Link>} />
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Channels</h2>
              <Link href="/channels" className="text-xs font-medium text-brand hover:underline">Manage</Link>
            </div>
            <ul className="space-y-2.5">
              {channels?.data.slice(0, 5).map((channel) => (
                <li key={channel.id} className="flex items-center gap-3">
                  <PlatformIcon platform={channel.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{channel.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{channel.username ? `@${channel.username}` : channel.platform_label}</p>
                  </div>
                  {channel.is_simulated ? <SimulatedBadge /> : <StatusBadge status={channel.status} />}
                </li>
              ))}
              {channels?.data.length === 0 && <p className="text-sm text-muted-foreground">No channels yet.</p>}
            </ul>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Needs attention</h2>
            <Link href="/inbox?filter=needs_human" className="flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted">
              <span className="flex size-8 items-center justify-center rounded-lg bg-warning/10 text-warning"><Inbox className="size-4" /></span>
              <span className="flex-1 text-sm">Conversations waiting for a human</span>
              <span className="text-sm font-semibold tabular-nums">{overview?.totals.needs_human ?? "–"}</span>
            </Link>
            <Link href="/ai" className="flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Bot className="size-4" /></span>
              <span className="flex-1 text-sm">Train your AI assistant</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>
          </section>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Automations</h2>
            <Link href="/automations" className="text-xs font-medium text-brand hover:underline">View all</Link>
          </div>
          <ul className="divide-y">
            {automations?.data.slice(0, 5).map((automation) => (
              <li key={automation.id}>
                <Link href={`/automations/${automation.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Workflow className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{automation.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{automation.trigger_label}{automation.trigger_config.keywords?.length ? ` · ${automation.trigger_config.keywords.join(", ")}` : ""}</p>
                  </div>
                  <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">{automation.runs_count} runs</span>
                  <StatusBadge status={automation.status} />
                </Link>
              </li>
            ))}
            {automations?.data.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No automations yet.</li>}
          </ul>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="text-sm font-semibold">Recent runs</h2>
            <Link href="/analytics" className="text-xs font-medium text-brand hover:underline">Analytics</Link>
          </div>
          <ul className="divide-y">
            {runs?.data.map((run) => (
              <li key={run.id} className="flex items-center gap-3 px-5 py-3">
                <span className={cn("size-2 rounded-full", run.status === "completed" ? "bg-success" : run.status === "failed" ? "bg-destructive" : "bg-warning")} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm"><span className="font-medium">{run.contact?.display_name ?? "Contact"}</span> <span className="text-muted-foreground">via {run.automation?.name}</span></p>
                  <p className="text-xs text-muted-foreground">{timeAgo(run.started_at)}</p>
                </div>
                {run.is_simulated && <SimulatedBadge />}
                <StatusBadge status={run.status} />
              </li>
            ))}
            {runs?.data.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Runs appear here when an automation fires.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}
