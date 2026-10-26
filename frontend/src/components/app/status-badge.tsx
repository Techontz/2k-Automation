import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  brand: "bg-brand-soft text-brand ring-brand/20",
  neutral: "bg-muted text-muted-foreground ring-border",
} as const;

const STATUS_TONES: Record<string, keyof typeof TONES> = {
  active: "success",
  connected: "success",
  completed: "success",
  sent: "success",
  delivered: "success",
  read: "success",
  processed: "success",
  open: "brand",
  running: "brand",
  waiting: "warning",
  paused: "warning",
  queued: "warning",
  scheduled: "warning",
  sending: "warning",
  blocked: "warning",
  skipped: "neutral",
  expired: "danger",
  failed: "danger",
  error: "danger",
  draft: "neutral",
  closed: "neutral",
  disconnected: "neutral",
  ignored: "neutral",
  cancelled: "neutral",
  received: "neutral",
};

export function StatusBadge({ status, label, tone, className }: { status: string; label?: string; tone?: keyof typeof TONES; className?: string }) {
  const resolved = tone ?? STATUS_TONES[status] ?? "neutral";

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-medium capitalize ring-1 ring-inset", TONES[resolved], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

/** Marks anything produced by simulation mode so it is never confused with real traffic. */
export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border border-dashed border-warning/50 bg-warning/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-warning", className)}>
      <FlaskConical className="size-3" />
      Simulated
    </span>
  );
}
