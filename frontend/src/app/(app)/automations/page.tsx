"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import useSWR from "swr";
import { Bot, MessageCircleReply, MessageSquare, MousePointerClick, Plus, Search, Workflow, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { AutomationActions } from "@/components/automations/automation-actions";
import { TemplateDialog } from "@/components/automations/template-dialog";
import { useCan } from "@/hooks/use-session";
import { qs } from "@/lib/api";
import { compact, timeAgo } from "@/lib/format";
import type { Automation, TriggerType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRIGGER_ICONS: Record<TriggerType, LucideIcon> = {
  comment_keyword: MessageCircleReply,
  dm_keyword: MessageSquare,
  story_reply: Bot,
  any_dm: MessageSquare,
  postback: MousePointerClick,
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "draft", label: "Drafts" },
];

function AutomationsView() {
  const router = useRouter();
  const params = useSearchParams();
  const canManage = useCan("automations.manage");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const dialogOpen = params.get("new") === "1";
  const { data, mutate, isLoading } = useSWR<{ data: Automation[] }>(`automations${qs({ status, search })}`, { keepPreviousData: true });

  function setDialog(open: boolean) {
    router.replace(open ? "/automations?new=1" : "/automations", { scroll: false });
  }

  const automations = data?.data ?? [];
  const filtering = Boolean(status || search);

  return (
    <>
      <PageHeader
        title="Automations"
        description="Keyword triggers, private replies, lead capture and AI — each running within the platform's messaging rules."
        actions={canManage && (
          <Button onClick={() => setDialog(true)}>
            <Plus className="size-4" /> New automation
          </Button>
        )}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatus(filter.value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                status === filter.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search automations" className="pl-8" />
        </div>
      </div>

      {isLoading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[72px] rounded-xl" />)}
        </div>
      ) : automations.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title={filtering ? "No automations match" : "Create your first automation"}
          description={filtering ? "Try a different filter or search." : "Reply to Reel comments, DM links and capture leads automatically. Start from a template in seconds."}
          action={!filtering && canManage && <Button onClick={() => setDialog(true)}><Plus className="size-4" /> New automation</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[minmax(0,1fr)_110px_90px_90px_120px_40px] gap-4 border-b bg-muted/40 px-5 py-2.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Automation</span>
            <span>Status</span>
            <span className="text-right">Runs</span>
            <span className="text-right">Success</span>
            <span>Last run</span>
            <span />
          </div>
          <ul className="divide-y">
            {automations.map((automation) => {
              const Icon = TRIGGER_ICONS[automation.trigger_type] ?? Workflow;
              const success = automation.runs_count > 0 ? Math.round((automation.completed_count / automation.runs_count) * 100) : null;
              const keywords = automation.trigger_config.match === "any" ? ["any"] : automation.trigger_config.keywords ?? [];
              return (
                <li key={automation.id} className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_110px_90px_90px_120px_40px]">
                  <Link href={`/automations/${automation.id}`} className="flex min-w-0 items-center gap-3 after:absolute after:inset-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{automation.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="truncate">{automation.trigger_label}</span>
                        {keywords.slice(0, 3).map((keyword) => (
                          <span key={keyword} className="hidden shrink-0 rounded bg-muted px-1.5 py-px font-mono text-[0.65rem] text-foreground/80 sm:inline">{keyword}</span>
                        ))}
                        {keywords.length > 3 && <span className="hidden sm:inline">+{keywords.length - 3}</span>}
                      </span>
                    </span>
                  </Link>
                  <span className="hidden md:block"><StatusBadge status={automation.status} /></span>
                  <span className="hidden text-right text-sm tabular-nums md:block">{compact(automation.runs_count)}</span>
                  <span className="hidden text-right text-sm tabular-nums md:block">
                    {success === null ? <span className="text-muted-foreground">—</span> : <span className={cn(success < 80 && "text-warning")}>{success}%</span>}
                    {automation.failed_count > 0 && <span className="block text-[0.7rem] text-destructive">{automation.failed_count} failed</span>}
                  </span>
                  <span className="hidden text-xs text-muted-foreground md:block">{timeAgo(automation.last_run_at)}</span>
                  <span className="relative z-10 flex items-center justify-end gap-2">
                    <span className="md:hidden"><StatusBadge status={automation.status} /></span>
                    {canManage && <AutomationActions automation={automation} onChanged={() => mutate()} />}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <TemplateDialog open={dialogOpen} onOpenChange={setDialog} />
    </>
  );
}

export default function AutomationsPage() {
  return (
    <Suspense>
      <AutomationsView />
    </Suspense>
  );
}
