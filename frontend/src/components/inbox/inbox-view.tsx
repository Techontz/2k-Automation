"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactPanel } from "./contact-panel";
import { ConversationList, type InboxFilters } from "./conversation-list";
import { MessageThread, type ThreadResponse } from "./message-thread";

export function InboxView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedId = params.get("c") ? Number(params.get("c")) : null;
  const [showDetails, setShowDetails] = useState(true);
  const [filters, setFilters] = useState<InboxFilters>({
    status: "open",
    filter: params.get("filter") ?? "all",
    search: "",
    channel: "",
    simulated: "",
  });
  const { data: thread } = useSWR<ThreadResponse>(selectedId ? `conversations/${selectedId}` : null);

  function select(id: number | null) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("c", String(id));
    else next.delete("c");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem-3rem)] min-h-[520px] overflow-hidden rounded-xl border bg-card lg:h-[calc(100dvh-3.5rem-4rem)]">
      <aside className={cn("w-full shrink-0 border-r md:w-[320px] lg:w-[340px]", selectedId ? "hidden md:block" : "block")}>
        <ConversationList filters={filters} onFiltersChange={setFilters} selectedId={selectedId} onSelect={select} />
      </aside>

      <section className={cn("min-w-0 flex-1", selectedId ? "block" : "hidden md:block")}>
        {selectedId ? (
          <MessageThread key={selectedId} conversationId={selectedId} onBack={() => select(null)} onToggleDetails={() => setShowDetails((value) => !value)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Inbox className="size-5" />
            </span>
            <p className="mt-4 text-sm font-semibold">Select a conversation</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Instagram, Messenger and WhatsApp conversations all land here.</p>
          </div>
        )}
      </section>

      {selectedId && showDetails && thread && (
        <aside className="hidden w-[300px] shrink-0 border-l xl:block">
          <ContactPanel conversation={thread.conversation} />
        </aside>
      )}
    </div>
  );
}
