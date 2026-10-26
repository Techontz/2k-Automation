"use client";

import Link from "next/link";
import { use } from "react";
import useSWR from "swr";
import { Loader2, Workflow } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { FlowBuilder } from "@/components/automations/flow-builder";
import type { Automation } from "@/lib/types";

export default function AutomationBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error } = useSWR<{ data: Automation }>(`automations/${id}`, { revalidateOnMount: true });

  if (error) {
    return (
      <div className="p-8">
        <EmptyState icon={Workflow} title="Automation not found" description="It may have been deleted, or it belongs to another workspace." action={<Link href="/automations" className={buttonVariants()}>Back to automations</Link>} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return <FlowBuilder key={data.data.id} automation={data.data} />;
}
