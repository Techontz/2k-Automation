"use client";

import { useState } from "react";
import useSWR from "swr";
import { AlertTriangle, AtSign, BarChart3, Inbox, MessageSquareText, Send, Table2, Users, Workflow } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ActivityChart } from "@/components/charts/activity-chart";
import { AutomationTable, type AutomationStat } from "@/components/analytics/automation-table";
import { OutcomesChart } from "@/components/analytics/outcomes-chart";
import { TimeseriesTable } from "@/components/analytics/timeseries-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { qs } from "@/lib/api";
import { compact, delta } from "@/lib/format";
import type { Overview, TimeseriesPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGES = [7, 14, 30, 90] as const;

export default function AnalyticsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [includeSimulated, setIncludeSimulated] = useState(false);
  const [tableView, setTableView] = useState(false);
  const query = qs({ days, include_simulated: includeSimulated ? 1 : undefined });

  const { data: overview } = useSWR<Overview>(`analytics/overview${query}`);
  const { data: series } = useSWR<{ data: TimeseriesPoint[] }>(`analytics/timeseries${query}`);
  const { data: automations } = useSWR<{ data: AutomationStat[] }>(`analytics/automations${query}`);

  const current = overview?.current;
  const previous = overview?.previous;
  const points = series?.data ?? [];
  const hasEngagement = points.some((point) => point.comments + point.received + point.sent > 0);
  const hasOutbound = points.some((point) => point.sent + point.failed + point.blocked > 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Real performance computed from stored events — every comment, message and automation run."
        actions={
          <>
            <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium">
              <Switch size="sm" checked={includeSimulated} onCheckedChange={setIncludeSimulated} />
              Include simulated
            </label>
            <div className="flex rounded-lg border bg-card p-0.5" role="group" aria-label="Date range">
              {RANGES.map((range) => (
                <button
                  key={range}
                  onClick={() => setDays(range)}
                  aria-pressed={days === range}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    days === range ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {range}d
                </button>
              ))}
            </div>
          </>
        }
      />

      {includeSimulated && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-dashed border-warning/50 bg-warning/5 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="size-3.5" /> Simulated test traffic is included in these numbers.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {current && previous && overview ? (
          <>
            <StatCard label="Comments processed" value={compact(current.comments_processed)} change={delta(current.comments_processed, previous.comments_processed)} icon={MessageSquareText} hint={`${current.keyword_matches} keyword matches`} />
            <StatCard label="Messages delivered" value={compact(current.messages_sent)} change={delta(current.messages_sent, previous.messages_sent)} icon={Send} hint={`${current.private_replies} private replies`} />
            <StatCard
              label="Delivery rate"
              value={current.delivery_rate === null ? "—" : `${current.delivery_rate}%`}
              icon={BarChart3}
              hint={`${current.messages_failed} failed · ${current.messages_blocked} blocked`}
            />
            <StatCard label="Automation runs" value={compact(current.runs)} change={delta(current.runs, previous.runs)} icon={Workflow} hint={`${overview.totals.active_automations} active automations`} />
            <StatCard label="Messages received" value={compact(current.messages_received)} change={delta(current.messages_received, previous.messages_received)} icon={Inbox} hint={`${overview.totals.open_conversations} open conversations`} />
            <StatCard label="New contacts" value={compact(current.new_contacts)} change={delta(current.new_contacts, previous.new_contacts)} icon={Users} hint={`${compact(overview.totals.contacts)} total`} />
            <StatCard label="Leads with email" value={compact(current.leads_with_email)} change={delta(current.leads_with_email, previous.leads_with_email)} icon={AtSign} hint="Collected with consent" />
            <StatCard label="Needs a human" value={overview.totals.needs_human} icon={AlertTriangle} hint="Open conversations flagged for handover" />
          </>
        ) : (
          Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-[106px] rounded-xl" />)
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Engagement</h2>
              <p className="text-xs text-muted-foreground">Comments, messages received and messages delivered per day</p>
            </div>
            <button
              onClick={() => setTableView((value) => !value)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-pressed={tableView}
            >
              <Table2 className="size-3.5" /> {tableView ? "Chart view" : "Table view"}
            </button>
          </div>
          {!series ? (
            <Skeleton className="h-[290px]" />
          ) : tableView ? (
            <TimeseriesTable data={points} />
          ) : hasEngagement ? (
            <ActivityChart
              height={250}
              data={points}
              series={[
                { key: "sent", label: "Messages delivered", color: "--chart-1" },
                { key: "received", label: "Messages received", color: "--chart-2" },
                { key: "comments", label: "Comments", color: "--chart-3" },
              ]}
            />
          ) : (
            <EmptyState className="h-[290px] border-none" icon={BarChart3} title="No engagement in this period" description="Try a longer range or include simulated data." />
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Delivery outcomes</h2>
            <p className="text-xs text-muted-foreground">Outbound messages by result. “Blocked” means the platform rules did not allow the send.</p>
          </div>
          {!series ? (
            <Skeleton className="h-[270px]" />
          ) : tableView ? (
            <TimeseriesTable data={points} />
          ) : hasOutbound ? (
            <OutcomesChart data={points} />
          ) : (
            <EmptyState className="h-[270px] border-none" icon={Send} title="No outbound messages" description="Delivery results appear once automations start sending." />
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold">Automation performance</h2>
          <p className="text-xs text-muted-foreground">Runs started in the last {days} days</p>
        </div>
        {automations ? <AutomationTable rows={automations.data} /> : <Skeleton className="m-5 h-40" />}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <LeadTile label="Lead conversion" value={current && current.new_contacts > 0 ? `${Math.round((current.leads_with_email / current.new_contacts) * 100)}%` : "—"} hint="New contacts who shared an email" />
        <LeadTile label="Keyword match rate" value={current && current.comments_processed > 0 ? `${Math.round((current.keyword_matches / current.comments_processed) * 100)}%` : "—"} hint="Comments that triggered an automation" />
        <LeadTile label="Private reply share" value={current && current.messages_sent > 0 ? `${Math.round((current.private_replies / current.messages_sent) * 100)}%` : "—"} hint="Delivered messages sent as comment private replies" />
      </section>
    </>
  );
}

function LeadTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5">
      <p className="text-[0.8rem] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
