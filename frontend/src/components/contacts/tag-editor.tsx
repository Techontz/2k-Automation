"use client";

import { useState } from "react";
import useSWR from "swr";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Tag } from "@/lib/types";

/** Chip input for a contact's tags; new names are created on save. */
export function TagEditor({ value, onChange, disabled }: { value: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
  const { data } = useSWR<{ data: Tag[] }>("tags");
  const [input, setInput] = useState("");
  const colors = Object.fromEntries((data?.data ?? []).map((tag) => [tag.name.toLowerCase(), tag.color]));

  function add(name: string) {
    const clean = name.trim();
    if (clean && !value.some((tag) => tag.toLowerCase() === clean.toLowerCase())) onChange([...value, clean]);
    setInput("");
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
          <span className="size-1.5 rounded-full" style={{ background: colors[tag.toLowerCase()] ?? "var(--brand)" }} />
          {tag}
          {!disabled && (
            <button type="button" onClick={() => onChange(value.filter((item) => item !== tag))} aria-label={`Remove ${tag}`} className="text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <>
          <Input
            list="workspace-tags"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                add(input);
              } else if (event.key === "Backspace" && !input && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={() => input && add(input)}
            placeholder={value.length ? "" : "Add a tag…"}
            className="h-6 min-w-[100px] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
            aria-label="Add tag"
          />
          <datalist id="workspace-tags">
            {data?.data.map((tag) => <option key={tag.id} value={tag.name} />)}
          </datalist>
        </>
      )}
    </div>
  );
}
