"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCan } from "@/hooks/use-session";
import { api } from "@/lib/api";
import type { Tag } from "@/lib/types";

const COLORS = ["#5B3DF5", "#008BA3", "#C27400", "#12A150", "#E5484D", "#6B6B7B"];

export function TagsManager({ onChange }: { onChange?: () => void }) {
  const canEdit = useCan("contacts.edit");
  const { data, mutate } = useSWR<{ data: Tag[] }>("tags");
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [pending, setPending] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    try {
      await api.post("tags", { name: name.trim(), color });
      setName("");
      await mutate();
      onChange?.();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove(tag: Tag) {
    if (!window.confirm(`Delete the tag "${tag.name}"? It will be removed from ${tag.contacts_count ?? 0} contacts.`)) return;
    try {
      await api.delete(`tags/${tag.id}`);
      await mutate();
      onChange?.();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <Tags className="size-4" /> Tags
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tags</DialogTitle>
          <DialogDescription>Tags segment contacts for automations and email campaigns.</DialogDescription>
        </DialogHeader>
        {canEdit && (
          <form onSubmit={create} className="flex items-center gap-2">
            <div className="flex gap-1">
              {COLORS.map((swatch) => (
                <button
                  type="button"
                  key={swatch}
                  onClick={() => setColor(swatch)}
                  aria-label={`Color ${swatch}`}
                  className="size-5 rounded-full ring-offset-2 ring-offset-popover transition-shadow"
                  style={{ background: swatch, boxShadow: color === swatch ? `0 0 0 2px var(--popover), 0 0 0 4px ${swatch}` : undefined }}
                />
              ))}
            </div>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New tag" maxLength={60} className="flex-1" />
            <Button type="submit" size="sm" disabled={pending || !name.trim()}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add
            </Button>
          </form>
        )}
        <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
          {data?.data.map((tag) => (
            <li key={tag.id} className="flex items-center gap-3 px-3 py-2">
              <span className="size-2.5 rounded-full" style={{ background: tag.color }} />
              <span className="flex-1 text-sm font-medium">{tag.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{tag.contacts_count ?? 0} contacts</span>
              {canEdit && (
                <Button variant="ghost" size="icon-xs" onClick={() => remove(tag)} aria-label={`Delete ${tag.name}`}>
                  <Trash2 className="size-3" />
                </Button>
              )}
            </li>
          ))}
          {data?.data.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No tags yet.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
