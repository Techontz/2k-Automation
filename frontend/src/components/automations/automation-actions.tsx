"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, MoreHorizontal, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError, api } from "@/lib/api";
import type { Automation } from "@/lib/types";

export function AutomationActions({ automation, onChanged }: { automation: Automation; onChanged: () => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      onChanged();
    } catch (error) {
      const details = error instanceof ApiError ? Object.values(error.errors).flat()[0] : undefined;
      toast.error(details ?? (error as Error).message);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Automation actions" onClick={(event) => event.stopPropagation()} />}>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => router.push(`/automations/${automation.id}`)}>
            <Pencil className="size-3.5" /> Edit flow
          </DropdownMenuItem>
          {automation.status === "active" ? (
            <DropdownMenuItem onClick={() => run(() => api.post(`automations/${automation.id}/pause`), "Automation paused")}>
              <Pause className="size-3.5" /> Pause
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => run(() => api.post(`automations/${automation.id}/activate`), "Automation is live")}>
              <Play className="size-3.5" /> Activate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => run(() => api.post(`automations/${automation.id}/duplicate`), "Automation duplicated")}>
            <Copy className="size-3.5" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2 className="size-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{automation.name}”?</AlertDialogTitle>
            <AlertDialogDescription>It stops running immediately. Run history is kept for analytics.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { setConfirming(false); run(() => api.delete(`automations/${automation.id}`), "Automation deleted"); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
