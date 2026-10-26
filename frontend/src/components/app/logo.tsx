import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex size-8 items-center justify-center rounded-[10px] bg-brand text-white shadow-[0_4px_12px_-4px_var(--brand)]">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 16.5 9.5 11 13 14.5 20 7.5" />
          <path d="M15 7.5h5v5" />
        </svg>
      </span>
      {!compact && (
        <span className="text-[0.95rem] font-semibold tracking-tight">
          2K <span className="font-normal text-muted-foreground">Automation</span>
        </span>
      )}
    </span>
  );
}
