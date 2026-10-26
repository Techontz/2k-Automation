"use client";

import useSWR from "swr";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SimulatedBadge } from "@/components/app/status-badge";
import { qs } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Channel, Conversation, Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "./contact-avatar";
import { FilterSelect } from "./filter-select";

export interface InboxFilters {
  status: string;
  filter: string;
  search: string;
  channel: string;
  simulated: string;
}

export function conversationsKey(filters: InboxFilters): string {
  return `conversations${qs({
    status: filters.status,
    filter: filters.filter === "all" ? "" : filters.filter,
    search: filters.search,
    channel_id: filters.channel,
    simulated: filters.simulated === "" ? undefined : filters.simulated,
  })}`;
}

export function ConversationList({
  filters,
  onFiltersChange,
  selectedId,
  onSelect,
}: {
  filters: InboxFilters;
  onFiltersChange: (filters: InboxFilters) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { data, isLoading } = useSWR<Paginated<Conversation>>(conversationsKey(filters), { refreshInterval: 10000, keepPreviousData: true });
  const { data: channels } = useSWR<{ data: Channel[] }>("channels");
  const set = (patch: Partial<InboxFilters>) => onFiltersChange({ ...filters, ...patch });

  const tabs = [
    { value: "all", label: "All" },
    { value: "mine", label: "Mine" },
    { value: "unassigned", label: "Unassigned" },
    { value: "needs_human", label: "Needs human" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) => set({ search: event.target.value })}
            placeholder="Search name, @username or email"
            className="h-8 pl-8"
            aria-label="Search conversations"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Conversation filter">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={filters.filter === tab.value}
              onClick={() => set({ filter: tab.value })}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filters.filter === tab.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            ariaLabel="Status"
            value={filters.status}
            onChange={(status) => set({ status })}
            className="w-[92px] min-w-0 flex-none"
            options={[
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
              { value: "snoozed", label: "Snoozed" },
              { value: "all", label: "All statuses" },
            ]}
          />
          <FilterSelect
            ariaLabel="Channel"
            value={filters.channel}
            onChange={(channel) => set({ channel })}
            className="min-w-0 flex-1"
            options={[{ value: "", label: "All channels" }, ...(channels?.data ?? []).map((channel) => ({ value: String(channel.id), label: channel.name }))]}
          />
          <FilterSelect
            ariaLabel="Traffic"
            value={filters.simulated}
            onChange={(simulated) => set({ simulated })}
            className="min-w-0 flex-1"
            options={[
              { value: "", label: "All traffic" },
              { value: "0", label: "Real only" },
              { value: "1", label: "Simulated only" },
            ]}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && !data ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : data?.data.length ? (
          <ul className="p-1.5">
            {data.data.map((conversation) => {
              const name = conversation.contact?.display_name ?? "Unknown contact";
              const unread = conversation.unread_count > 0;
              return (
                <li key={conversation.id}>
                  <button
                    onClick={() => onSelect(conversation.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors",
                      selectedId === conversation.id ? "bg-sidebar-accent" : "hover:bg-muted/60",
                    )}
                  >
                    <ContactAvatar name={name} platform={conversation.channel?.platform} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn("flex-1 truncate text-sm", unread ? "font-semibold" : "font-medium")}>{name}</span>
                        <span className="shrink-0 text-[0.68rem] text-muted-foreground">{timeAgo(conversation.last_message_at).replace(" ago", "")}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={cn("flex-1 truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")}>
                          {conversation.last_message_preview ?? "No messages yet"}
                        </span>
                        {unread && <span className="size-2 shrink-0 rounded-full bg-brand" aria-label={`${conversation.unread_count} unread`} />}
                      </span>
                      {(conversation.needs_human || conversation.is_simulated || conversation.assignee) && (
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {conversation.needs_human && (
                            <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-warning">Needs human</span>
                          )}
                          {conversation.is_simulated && <SimulatedBadge />}
                          {conversation.assignee && <span className="text-[0.65rem] text-muted-foreground">→ {conversation.assignee.name}</span>}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium">No conversations</p>
            <p className="mt-1 text-xs text-muted-foreground">Try another filter, or send a test DM from the simulator.</p>
          </div>
        )}
      </div>
    </div>
  );
}
