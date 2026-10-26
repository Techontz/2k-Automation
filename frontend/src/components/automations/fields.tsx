"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-foreground/80">{label}</Label>
      {children}
      {hint && <p className="text-[0.72rem] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Styled native select: robust, accessible and keyboard-friendly. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function SwitchRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border bg-background/50 px-3 py-2.5">
      <span>
        <span className="block text-[0.8rem] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[0.72rem] text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} disabled={disabled} className="mt-0.5" />
    </label>
  );
}

/** Enter or comma adds a chip; backspace on empty input removes the last. */
export function ChipsInput({ value, onChange, placeholder, suggestions = [], disabled }: { value: string[]; onChange: (value: string[]) => void; placeholder?: string; suggestions?: string[]; disabled?: boolean }) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const next = raw.trim();
    if (next && !value.some((item) => item.toLowerCase() === next.toLowerCase())) onChange([...value, next]);
    setDraft("");
  }

  const remaining = suggestions.filter((item) => !value.includes(item) && item.toLowerCase().includes(draft.toLowerCase())).slice(0, 6);

  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        {value.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand">
            {item}
            {!disabled && (
              <button type="button" onClick={() => onChange(value.filter((entry) => entry !== item))} aria-label={`Remove ${item}`} className="opacity-60 hover:opacity-100">
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        <input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            } else if (event.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[90px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {draft && remaining.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {remaining.map((item) => (
            <button key={item} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => add(item)} className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted">
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TextInput(props: React.ComponentProps<typeof Input>) {
  return <Input {...props} />;
}

export function PolicyHint({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warning" }) {
  return (
    <div className={cn("flex gap-2 rounded-lg px-3 py-2 text-[0.72rem] leading-relaxed", tone === "warning" ? "bg-warning/10 text-warning" : "bg-brand-soft/70 text-accent-foreground")}>
      <Info className="mt-px size-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export const VARIABLES = ["{{first_name}}", "{{name}}", "{{username}}", "{{email}}", "{{keyword}}"];

export function VariableHints({ onInsert }: { onInsert: (variable: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {VARIABLES.map((variable) => (
        <button key={variable} type="button" onClick={() => onInsert(variable)} className="rounded-md border bg-background px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand">
          {variable}
        </button>
      ))}
    </div>
  );
}
