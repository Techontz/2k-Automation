"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, MessageSquareText, Search, Workflow } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { FilterSelect } from "@/components/inbox/filter-select";
import { qs } from "@/lib/api";
import type { Channel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CommentCard, type CommentRow } from "./comment-card";
import { CommentRules } from "./comment-rules";

interface CommentPage {
  data: CommentRow[];
  current_page: number;
  last_page: number;
  total: number;
}

const TABS = [
  { value: "", label: "All comments" },
  { value: "matched", label: "Keyword matches" },
  { value: "unanswered", label: "Unanswered" },
];

export function CommentsView() {
  const [filter, setFilter] = useState("");
  const [channel, setChannel] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, mutate } = useSWR<CommentPage>(`comments${qs({ filter, channel_id: channel, search, page })}`, { refreshInterval: 15000, keepPreviousData: true });
  const { data: channels } = useSWR<{ data: Channel[] }>("channels");
  const commentChannels = (channels?.data ?? []).filter((item) => item.capabilities.comment_reply);

  return (
    <>
      <PageHeader
        title="Comments"
        description="Comments on your posts and Reels, which keywords they matched, and how each one was answered."
        actions={
          <Link href="/automations" className={buttonVariants({ variant: "outline" })}>
            <Workflow className="size-4" /> Keyword automations
          </Link>
        }
      />

      <CommentRules />

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex gap-1 rounded-lg bg-muted p-[3px]" role="tablist" aria-label="Comment filter">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={filter === tab.value}
              onClick={() => {
                setFilter(tab.value);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                filter === tab.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap gap-2 md:justify-end">
          <FilterSelect
            ariaLabel="Channel"
            value={channel}
            onChange={(value) => {
              setChannel(value);
              setPage(1);
            }}
            options={[{ value: "", label: "All channels" }, ...commentChannels.map((item) => ({ value: String(item.id), label: item.name }))]}
          />
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search comment text"
              className="h-8 bg-card pl-8"
              aria-label="Search comments"
            />
          </div>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : data?.data.length ? (
        <>
          <ul className="space-y-3">
            {data.data.map((comment) => (
              <CommentCard key={comment.id} comment={comment} onReplied={() => mutate()} />
            ))}
          </ul>
          {data.last_page > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {data.current_page} of {data.last_page} · {data.total} comments
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon-sm" disabled={data.current_page <= 1} onClick={() => setPage(data.current_page - 1)} aria-label="Previous page">
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button variant="outline" size="icon-sm" disabled={data.current_page >= data.last_page} onClick={() => setPage(data.current_page + 1)} aria-label="Next page">
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={MessageSquareText}
          title={filter || search || channel ? "No comments match these filters" : "No comments yet"}
          description="Comments appear here as soon as your connected accounts receive them. Try the simulator to send a test comment."
          action={<Link href="/simulator" className={buttonVariants({ size: "sm" })}>Open simulator</Link>}
        />
      )}
    </>
  );
}
