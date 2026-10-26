"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, MailPlus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/app/status-badge";
import { useSession } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api";
import { initials, timeAgo } from "@/lib/format";
import type { Role } from "@/lib/types";
import { ConfirmDialog, CopyField, FormField, NativeSelect, SectionCard } from "./form-kit";

interface Member {
  id: number;
  name: string;
  email: string;
  role: Role;
  joined_at: string;
}

interface Invitation {
  id: number;
  email: string;
  role: Role;
  expires_at: string;
  created_at: string;
}

const ROLE_INFO: Record<Role, string> = {
  owner: "Full control, including billing and deleting the workspace.",
  admin: "Manage channels, team, settings and everything editors can do.",
  editor: "Build automations, email and AI settings; run simulations.",
  agent: "Reply in the inbox and edit contacts.",
  viewer: "Read-only access to dashboards and data.",
};

const ASSIGNABLE: Role[] = ["admin", "editor", "agent", "viewer"];

export function TeamTab({ canManage }: { canManage: boolean }) {
  const { user } = useSession();
  const { data, mutate } = useSWR<{ members: Member[]; invitations: Invitation[] }>("team");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  async function changeRole(member: Member, role: Role) {
    try {
      await api.patch(`team/members/${member.id}`, { role });
      toast.success(`${member.name} is now ${role === "admin" ? "an" : "a"} ${role}`);
      mutate();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function revoke(invitation: Invitation) {
    try {
      await api.delete(`team/invitations/${invitation.id}`);
      toast.success("Invitation revoked");
      mutate();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Members"
        description="Everyone with access to this workspace."
        actions={
          canManage && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-3.5" /> Invite member
            </Button>
          )
        }
        bodyClassName="p-0"
      >
        {!data ? (
          <div className="p-5">
            <Skeleton className="h-24" />
          </div>
        ) : (
          <ul className="divide-y">
            {data.members.map((member) => (
              <li key={member.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{initials(member.name)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {member.name} {member.id === user?.id && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email} · joined {timeAgo(member.joined_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && member.role !== "owner" && member.id !== user?.id ? (
                    <>
                      <NativeSelect className="w-32" value={member.role} onChange={(event) => changeRole(member, event.target.value as Role)} aria-label={`Role for ${member.name}`}>
                        {ASSIGNABLE.map((role) => (
                          <option key={role} value={role}>
                            {role[0].toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </NativeSelect>
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${member.name}`} onClick={() => setRemoving(member)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <StatusBadge status={member.role} tone={member.role === "owner" ? "brand" : "neutral"} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {data && data.invitations.length > 0 && (
        <SectionCard title="Pending invitations" bodyClassName="p-0">
          <ul className="divide-y">
            {data.invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-3 px-5 py-3">
                <MailPlus className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="capitalize">{invitation.role}</span> · expires {timeAgo(invitation.expires_at)}
                  </p>
                </div>
                {canManage && (
                  <Button variant="ghost" size="sm" onClick={() => revoke(invitation)}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="Roles & permissions">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(ROLE_INFO) as Role[]).map((role) => (
            <div key={role} className="rounded-lg border p-3">
              <dt className="text-sm font-medium capitalize">{role}</dt>
              <dd className="mt-0.5 text-xs text-muted-foreground">{ROLE_INFO[role]}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={() => mutate()} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        description="They will immediately lose access to this workspace."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api.delete(`team/members/${removing.id}`);
            toast.success("Member removed");
            mutate();
          } catch (error) {
            toast.error((error as Error).message);
          }
        }}
      />
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onInvited }: { open: boolean; onOpenChange: (open: boolean) => void; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{ accept_url: string; added_existing_user: boolean } | null>(null);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setEmail("");
      setRole("agent");
      setErrors({});
      setResult(null);
    }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const response = await api.post<{ accept_url: string; added_existing_user: boolean }>("team/invitations", { email, role });
      setResult(response);
      onInvited();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.errors);
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>They get access with the role you choose. You can change it later.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            {result.added_existing_user ? (
              <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{email} already has an account and was added to this workspace.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Share this link with {email}. It expires in 7 days.</p>
                <CopyField value={result.accept_url} />
              </>
            )}
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={invite} className="space-y-4">
            <FormField label="Email" htmlFor="inv-email" error={errors.email?.[0]}>
              <Input id="inv-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" required />
            </FormField>
            <FormField label="Role" htmlFor="inv-role" hint={ROLE_INFO[role]}>
              <NativeSelect id="inv-role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
                {ASSIGNABLE.map((item) => (
                  <option key={item} value={item}>
                    {item[0].toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Send invite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
