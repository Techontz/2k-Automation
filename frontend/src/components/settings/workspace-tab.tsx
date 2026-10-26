"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import { FormField, NativeSelect, SaveBar, SectionCard } from "./form-kit";

function timezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "Africa/Dar_es_Salaam", "Africa/Nairobi", "Europe/London", "America/New_York"];
  }
}

export function WorkspaceTab({ canManage }: { canManage: boolean }) {
  const { data } = useSWR<{ data: Workspace }>("workspace");

  if (!data) return <Skeleton className="h-64 rounded-xl" />;

  return <WorkspaceForm key={JSON.stringify(data.data)} workspace={data.data} canManage={canManage} />;
}

function WorkspaceForm({ workspace, canManage }: { workspace: Workspace; canManage: boolean }) {
  const { mutate } = useSWR<{ data: Workspace }>("workspace");
  const { mutate: refreshSession } = useSession();
  const zones = useMemo(() => timezones(), []);
  const initial = { name: workspace.name, timezone: workspace.timezone, default_language: workspace.default_language };
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  async function save() {
    setPending(true);
    try {
      await api.patch("workspace", form);
      toast.success("Workspace updated");
      await Promise.all([mutate(), refreshSession()]);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <SectionCard title="Workspace details" description="Shared by everyone on your team.">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <FormField label="Workspace name" htmlFor="ws-name" className="sm:col-span-2">
            <Input id="ws-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={!canManage} />
          </FormField>
          <FormField label="Time zone" htmlFor="ws-tz" hint="Used for scheduling and analytics.">
            <NativeSelect id="ws-tz" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} disabled={!canManage}>
              {zones.includes(form.timezone) ? null : <option value={form.timezone}>{form.timezone}</option>}
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, " ")}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Default language" htmlFor="ws-lang" hint="Fallback for templates and AI replies.">
            <NativeSelect id="ws-lang" value={form.default_language} onChange={(event) => setForm({ ...form, default_language: event.target.value as "en" | "sw" })} disabled={!canManage}>
              <option value="en">English</option>
              <option value="sw">Swahili</option>
            </NativeSelect>
          </FormField>
        </div>
        <dl className="mt-6 grid max-w-2xl gap-3 border-t pt-4 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Workspace ID</dt>
            <dd className="mt-0.5 font-mono">{workspace.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="mt-0.5 font-mono">{workspace.slug}</dd>
          </div>
        </dl>
      </SectionCard>
      {canManage && <SaveBar dirty={JSON.stringify(form) !== JSON.stringify(initial)} pending={pending} onSave={save} onReset={() => setForm(initial)} />}
    </>
  );
}
