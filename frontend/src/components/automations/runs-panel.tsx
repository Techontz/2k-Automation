"use client";

import { useState } from "react";
import useSWR from "swr";
import { ChevronRight, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/empty-state";
import { SimulatedBadge, StatusBadge } from "@/components/app/status-badge";
import { dateTime, timeAgo } from "@/lib/format";
import type { Paginated, Run, RunStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NODE_META } from "./node-meta";

const STEP_DOT: Record<RunStep["status"], string> = {
  completed: "bg-success",
  blocked: "bg-warning",
  waiting: "bg-warning",
  failed: "bg-destructive",
  skipped: "bg-muted-foreground",
};

export function RunsPanel({ automationId }: { automationId: number }) {
  const { data, isLoading } = useSWR<Paginated<Run>>(`automations/${automationId}/runs`, { refreshInterval: 10000 });
  const [open, setOpen] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14" />)}
      </div>
    );
  }

  if (!data?.data.length) {
    return <EmptyState className="m-4" icon={History} title="No runs yet" description="Every time this automation fires, its steps are logged here." />;
  }

  return (
    <ul className="divide-y">
      {data.data.map((run) => (
        <li key={run.id}>
          <button onClick={() => setOpen(open === run.id ? null : run.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
            <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open === run.id && "rotate-90")} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{run.contact?.display_name ?? "Contact"}</p>
              <p className="text-xs text-muted-foreground">{timeAgo(run.started_at)}</p>
            </div>
            {run.is_simulated && <SimulatedBadge />}
            <StatusBadge status={run.status} />
          </button>
          {open === run.id && <RunTimeline runId={run.id} />}
        </li>
      ))}
    </ul>
  );
}

export function RunTimeline({ runId }: { runId: number }) {
  const { data } = useSWR<{ data: Run }>(`runs/${runId}`);
  const run = data?.data;

  if (!run) return <Skeleton className="mx-4 mb-3 h-24" />;

  return (
    <div className="px-4 pb-4">
      <ol className="relative ml-[7px] space-y-3 border-l pl-5">
        {run.steps?.map((step) => {
          const meta = NODE_META[step.node_type] ?? NODE_META.end;
          return (
            <li key={step.id} className="relative">
              <span className={cn("absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-card", STEP_DOT[step.status])} />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{meta.label}</span>
                {step.status !== "completed" && <StatusBadge status={step.status} />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.summary}</p>
            </li>
          );
        })}
      </ol>
      {run.waiting_for && (
        <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          Waiting for {run.waiting_for === "delay" ? "the delay to finish" : run.waiting_for === "email" ? "an email address" : "a reply"}
          {run.resume_at ? ` · until ${dateTime(run.resume_at)}` : ""}
        </p>
      )}
      {run.error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{run.error}</p>}
    </div>
  );
}
