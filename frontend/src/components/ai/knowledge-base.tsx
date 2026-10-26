"use client";

import { useState } from "react";
import { BookOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/app/empty-state";
import { ConfirmDialog, FormField, SectionCard } from "@/components/settings/form-kit";
import { api, ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KnowledgeItem } from "./types";

export function KnowledgeBase({ items, canManage, onChanged }: { items: KnowledgeItem[]; canManage: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState<KnowledgeItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<KnowledgeItem | null>(null);

  async function toggle(item: KnowledgeItem, enabled: boolean) {
    try {
      await api.patch(`ai/knowledge/${item.id}`, { enabled });
      onChanged();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <SectionCard
      title="Knowledge base"
      description="Facts the assistant may use: prices, delivery, hours, policies. Write one topic per entry."
      actions={
        canManage && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-3.5" /> Add entry
          </Button>
        )
      }
      bodyClassName={items.length ? "p-0" : undefined}
    >
      {items.length === 0 ? (
        <EmptyState
          className="border-none bg-transparent py-8"
          icon={BookOpen}
          title="Teach your assistant"
          description="Add answers to the questions customers ask most. The assistant hands over anything not covered here."
          action={canManage && <Button size="sm" variant="outline" onClick={() => setEditing("new")}>Add first entry</Button>}
        />
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className={cn("flex items-start gap-3 px-5 py-3.5", !item.enabled && "opacity-60")}>
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <BookOpen className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.content}</p>
                <p className="mt-1 text-[0.7rem] text-muted-foreground">Updated {timeAgo(item.updated_at)}</p>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Switch size="sm" checked={item.enabled} onCheckedChange={(value) => toggle(item, Boolean(value))} aria-label="Use this entry" />
                  <Button variant="ghost" size="icon-sm" aria-label="Edit entry" onClick={() => setEditing(item)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete entry" onClick={() => setDeleting(item)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <KnowledgeDialog item={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.title}”?`}
        description="The assistant will no longer use this information."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`ai/knowledge/${deleting.id}`);
          toast.success("Entry deleted");
          onChanged();
        }}
      />
    </SectionCard>
  );
}

function KnowledgeDialog({ item, onClose, onSaved }: { item: KnowledgeItem | "new" | null; onClose: () => void; onSaved: () => void }) {
  const existing = item && item !== "new" ? item : null;
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loadedFor, setLoadedFor] = useState<KnowledgeItem | "new" | null>(null);

  if (item !== loadedFor) {
    setLoadedFor(item);
    setTitle(existing?.title ?? "");
    setContent(existing?.content ?? "");
    setErrors({});
  }

  async function save() {
    setPending(true);
    setErrors({});
    try {
      if (existing) {
        await api.patch(`ai/knowledge/${existing.id}`, { title, content });
      } else {
        await api.post("ai/knowledge", { title, content });
      }
      toast.success("Knowledge saved");
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.errors);
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit knowledge" : "Add knowledge"}</DialogTitle>
          <DialogDescription>Plain, factual sentences work best. You can write in English or Swahili.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="Topic" htmlFor="kb-title" error={errors.title?.[0]}>
            <Input id="kb-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Delivery in Dar es Salaam" />
          </FormField>
          <FormField label="Answer" htmlFor="kb-content" error={errors.content?.[0]} hint={`${content.length}/10000`}>
            <Textarea
              id="kb-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-36"
              placeholder="We deliver across Dar es Salaam within 24 hours for TZS 5,000. Orders above TZS 50,000 ship free."
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !title.trim() || !content.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
