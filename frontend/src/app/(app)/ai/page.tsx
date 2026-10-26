"use client";

import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { KnowledgeBase } from "@/components/ai/knowledge-base";
import { Playground } from "@/components/ai/playground";
import { AiSettingsForm } from "@/components/ai/settings-form";
import type { AiOverview } from "@/components/ai/types";
import { useCan } from "@/hooks/use-session";

export default function AiPage() {
  const canManage = useCan("ai.manage");
  const { data, mutate } = useSWR<AiOverview>("ai");

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Brand-voiced replies in English and Swahili, grounded in your knowledge base, with automatic human handover."
        actions={data && <StatusBadge status={data.settings.enabled ? "active" : "paused"} label={data.settings.enabled ? "Enabled" : "Disabled"} />}
      />

      {!data ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-[640px] rounded-xl" />
          <Skeleton className="h-[560px] rounded-xl" />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-6">
            <KnowledgeBase items={data.knowledge} canManage={canManage} onChanged={() => mutate()} />
            <AiSettingsForm key={JSON.stringify(data.settings) + data.has_workspace_key} overview={data} canManage={canManage} onSaved={() => mutate()} />
          </div>
          <div className="lg:sticky lg:top-20">
            <Playground />
          </div>
        </div>
      )}
    </>
  );
}
