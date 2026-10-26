"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Bot, FilePlus2, Loader2, MailPlus, MessageCircleReply, MessageSquare, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Automation, AutomationTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, { icon: LucideIcon; chip: string }> = {
  comment_to_dm: { icon: MessageCircleReply, chip: "bg-brand-soft text-brand" },
  lead_magnet: { icon: MailPlus, chip: "bg-violet-500/12 text-violet-600 dark:text-violet-400" },
  story_reply_ai: { icon: Bot, chip: "bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-400" },
  dm_keyword_price: { icon: MessageSquare, chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400" },
  blank: { icon: FilePlus2, chip: "bg-muted text-muted-foreground" },
};

export function TemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { data } = useSWR<{ data: AutomationTemplate[] }>(open ? "automations/templates" : null);
  const [creating, setCreating] = useState<string | null>(null);

  async function create(template: string) {
    setCreating(template);
    try {
      const created = await api.post<{ data: Automation }>("automations", { template });
      router.push(`/automations/${created.data.id}`);
    } catch (error) {
      toast.error((error as Error).message);
      setCreating(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Create an automation</DialogTitle>
          <DialogDescription>Start from a proven template — every step can be customised in the builder.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {!data && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
          {data?.data.map((template) => {
            const visual = ICONS[template.key] ?? ICONS.blank;
            const Icon = visual.icon;
            return (
              <button
                key={template.key}
                disabled={creating !== null}
                onClick={() => create(template.key)}
                className={cn(
                  "group flex items-start gap-3 rounded-xl border bg-card p-3.5 text-left transition-all hover:border-brand/40 hover:shadow-sm disabled:opacity-60",
                  template.key === "blank" && "border-dashed",
                )}
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", visual.chip)}>
                  {creating === template.key ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold group-hover:text-brand">{template.name}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{template.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
