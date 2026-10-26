import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  change,
  hint,
  icon: Icon,
  invertChange = false,
}: {
  label: string;
  value: React.ReactNode;
  change?: number | null;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  invertChange?: boolean;
}) {
  const positive = change !== undefined && change !== null && (invertChange ? change < 0 : change > 0);
  const negative = change !== undefined && change !== null && (invertChange ? change > 0 : change < 0);

  return (
    <div className="animate-in-up rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(16,16,32,0.04)]">
      <div className="flex items-center justify-between">
        <span className="text-[0.8rem] font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        {change !== undefined && change !== null && (
          <span
            className={cn(
              "inline-flex items-center text-xs font-medium",
              positive && "text-success",
              negative && "text-destructive",
              !positive && !negative && "text-muted-foreground",
            )}
          >
            {change > 0 ? <ArrowUpRight className="size-3" /> : change < 0 ? <ArrowDownRight className="size-3" /> : null}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
