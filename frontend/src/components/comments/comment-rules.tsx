"use client";

import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const RULES = [
  { title: "Public replies", text: "You can reply publicly under any comment, at any time." },
  { title: "One private reply", text: "Each comment allows exactly one private reply (DM), sent within 7 days of the comment." },
  { title: "Then wait for them", text: "After a private reply, further DMs are only possible once the person replies — that opens a 24-hour messaging window." },
  { title: "No cold DMs", text: "2K Automation never messages people who haven't commented or written to you first." },
];

export function CommentRules() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-5 rounded-xl border bg-card">
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <ShieldCheck className="size-4" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">How Instagram comment automation works</span>
          <span className="block text-xs text-muted-foreground">Every reply follows Meta&apos;s official messaging rules, so your account stays safe.</span>
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid gap-3 border-t px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {RULES.map((rule, index) => (
            <div key={rule.title}>
              <p className="text-xs font-semibold">
                <span className="mr-1.5 text-brand">{index + 1}.</span>
                {rule.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rule.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
