"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Compact labelled select for toolbar filters. Empty string means "all". */
export function FilterSelect({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel: string;
}) {
  const items = Object.fromEntries(options.map((option) => [option.value, option.label]));

  return (
    <Select items={items} value={value} onValueChange={(next) => onChange(String(next ?? ""))}>
      <SelectTrigger size="sm" aria-label={ariaLabel} className={cn("min-w-[96px] bg-card", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
