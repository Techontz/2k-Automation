"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleSlash, Clock3, FastForward, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { timeAgo } from "@/lib/format";
import type { Run, RunStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NODE_META } from "./node-meta";

const STEP_STYLE: Record<RunStep["status"], { ring: string; icon: React.ComponentType<{ className?: string }>; text: string }> = {
  completed: { ring: "bg-success/10 text-success ring-success/25", icon: CheckCircle2, text: "text-success" },
  blocked: { ring: "bg-warning/10 text-warning ring-warning/25", icon: AlertTriangle, text: "text-warning" },
  failed: { ring: "bg-destructive/10 text-destructive ring-destructive/25", icon: XCircle, text: "text-destructive" },
  waiting: { ring: "bg-warning/10 text-warning ring-warning/25", icon: Clock3, text: "text-warning" },
  skipped: { ring: "bg-muted text-muted-foreground ring-border", icon: CircleSlash, text: "text-muted-foreground" },
};

const WAITING_LABEL: Record<NonNullable<Run["waiting_for"]>, string> = {
  delay: "Waiting for the delay to pass",
  reply: "Waiting for the person to reply",
  email: "Waiting for an email address",
};

/**
 * Step-by-step log of one automation run. New steps are revealed one at a
 * time so the user can follow what the engine did.
 */
export function RunTimeline({ run, onFastForward, fastForwarding }: { run: Run; onFastForward: (run: Run) => void; fastForwarding: boolean }) {
  const steps = run.steps ?? [];
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (revealed >= steps.length) return;
    const timer = window.setTimeout(() => setRevealed((count) => count + 1), revealed === 0 ? 80 : 220);
    return () => window.clearTimeout(timer);
  }, [revealed, steps.length]);

  const allShown = revealed >= steps.length;

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <Link href={`/automations/${run.automation_id}`} className="block truncate text-sm font-semibold hover:text-brand">
            {run.automation?.name ?? `Automation #${run.automation_id}`}
          </Link>
          <p className="text-xs text-muted-foreground">Run #{run.id} · {timeAgo(run.started_at)}</p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <ol className="relative px-4 py-4">
        {steps.slice(0, revealed).map((step, index) => {
          const meta = NODE_META[step.node_type] ?? NODE_META.end;
          const style = STEP_STYLE[step.status] ?? STEP_STYLE.completed;
          const last = index === Math.min(revealed, steps.length) - 1;
          return (
            <li key={step.id} className="relative flex animate-in-up gap-3 pb-4 last:pb-0">
              {!last && <span className="absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px bg-border" />}
              <span className={cn("relative flex size-[30px] shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", style.ring)}>
                <meta.icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[0.8rem] font-medium">{meta.label}</span>
                  <style.icon className={cn("size-3.5", style.text)} />
                  {step.duration_ms > 0 && <span className="ml-auto text-[0.65rem] tabular-nums text-muted-foreground">{step.duration_ms} ms</span>}
                </div>
                {step.summary && <p className={cn("mt-0.5 break-words text-xs", step.status === "completed" ? "text-muted-foreground" : style.text)}>{step.summary}</p>}
              </div>
            </li>
          );
        })}
        {!allShown && (
          <li className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Executing…
          </li>
        )}
      </ol>

      {allShown && run.status === "waiting" && run.waiting_for && (
        <div className="flex flex-col gap-3 border-t bg-warning/5 px-4 py-3 sm:flex-row sm:items-center">
          <Clock3 className="size-4 shrink-0 text-warning" />
          <div className="flex-1 text-xs">
            <p className="font-medium">{WAITING_LABEL[run.waiting_for]}</p>
            <p className="text-muted-foreground">
              {run.waiting_for === "delay" ? `Resumes ${timeAgo(run.resume_at)}.` : "Reply in the DM thread to continue"}
              {run.waiting_for !== "delay" && run.resume_at ? ` · times out ${timeAgo(run.resume_at)}` : run.waiting_for !== "delay" ? "." : ""}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onFastForward(run)} disabled={fastForwarding}>
            {fastForwarding ? <Loader2 className="size-3.5 animate-spin" /> : <FastForward className="size-3.5" />}
            {run.waiting_for === "delay" ? "Skip delay" : "Simulate timeout"}
          </Button>
        </div>
      )}

      {allShown && run.error && <p className="border-t px-4 py-3 text-xs text-destructive">{run.error}</p>}
    </div>
  );
}
