"use client";

import useSWR from "swr";
import type { User, Workspace } from "@/lib/types";

/** Current user, their workspaces and their role in the active workspace. */
export function useSession() {
  const { data, error, isLoading, mutate } = useSWR<{ data: User }>("auth/me");
  const user = data?.data;
  const workspace: Workspace | undefined = user?.workspaces?.find((item) => item.id === user.current_workspace_id) ?? user?.workspaces?.[0];

  return { user, workspace, role: workspace?.role, error, isLoading, mutate };
}

const ABILITIES: Record<string, string[]> = {
  viewer: ["view"],
  agent: ["view", "inbox.reply", "contacts.edit"],
  editor: ["view", "inbox.reply", "contacts.edit", "automations.manage", "email.manage", "ai.manage", "simulate"],
  admin: ["view", "inbox.reply", "contacts.edit", "automations.manage", "email.manage", "ai.manage", "simulate", "channels.manage", "team.manage", "settings.manage"],
};
ABILITIES.owner = [...ABILITIES.admin, "workspace.delete", "billing.manage"];

/** Mirrors App\Enums\WorkspaceRole::abilities() for hiding UI the API would reject. */
export function useCan(ability: string): boolean {
  const { role } = useSession();
  return role ? ABILITIES[role]?.includes(ability) ?? false : false;
}
