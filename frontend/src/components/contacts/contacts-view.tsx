"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Download, Search, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PLATFORM_LABELS } from "@/components/app/platform-icon";
import { SimulatedBadge } from "@/components/app/status-badge";
import { ContactAvatar } from "@/components/inbox/contact-avatar";
import { FilterSelect } from "@/components/inbox/filter-select";
import { useCan } from "@/hooks/use-session";
import { qs } from "@/lib/api";
import { compact, timeAgo } from "@/lib/format";
import type { Contact, Paginated, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContactSheet } from "./contact-sheet";
import { TagsManager } from "./tags-manager";

export function ContactsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const canExport = useCan("settings.manage");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [platform, setPlatform] = useState("");
  const [hasEmail, setHasEmail] = useState("");
  const [simulated, setSimulated] = useState("");
  const [page, setPage] = useState(1);
  const openId = params.get("contact") ? Number(params.get("contact")) : null;

  const filters = { search, tag_id: tag, platform, has_email: hasEmail, simulated: simulated === "" ? undefined : simulated };
  const key = `contacts${qs({ ...filters, page })}`;
  const { data, isLoading, mutate } = useSWR<Paginated<Contact>>(key, { keepPreviousData: true });
  const { data: tags, mutate: mutateTags } = useSWR<{ data: Tag[] }>("tags");
  const meta = data?.meta;

  function setOpen(id: number | null) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("contact", String(id));
    else next.delete("contact");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  }

  function filter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Everyone who has commented on or messaged your connected accounts, with their tags and consent records."
        actions={
          <>
            <TagsManager onChange={() => { mutateTags(); mutate(); }} />
            {canExport && (
              <a href={`/api/backend/contacts/export${qs(filters)}`} className={buttonVariants({ variant: "outline" })}>
                <Download className="size-4" /> Export CSV
              </a>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => filter(setSearch)(event.target.value)}
            placeholder="Search name, @username or email"
            className="h-8 bg-card pl-8"
            aria-label="Search contacts"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterSelect ariaLabel="Tag" value={tag} onChange={filter(setTag)} options={[{ value: "", label: "All tags" }, ...(tags?.data ?? []).map((item) => ({ value: String(item.id), label: item.name }))]} />
          <FilterSelect
            ariaLabel="Platform"
            value={platform}
            onChange={filter(setPlatform)}
            options={[{ value: "", label: "All platforms" }, ...(["instagram", "facebook", "whatsapp", "tiktok"] as const).map((value) => ({ value, label: PLATFORM_LABELS[value] }))]}
          />
          <FilterSelect
            ariaLabel="Email"
            value={hasEmail}
            onChange={filter(setHasEmail)}
            options={[
              { value: "", label: "Any email status" },
              { value: "1", label: "Has email" },
            ]}
          />
          <FilterSelect
            ariaLabel="Traffic"
            value={simulated}
            onChange={filter(setSimulated)}
            options={[
              { value: "", label: "Real + simulated" },
              { value: "0", label: "Real only" },
              { value: "1", label: "Simulated only" },
            ]}
          />
        </div>
        {meta && <span className="text-xs text-muted-foreground lg:ml-auto">{compact(meta.total)} contacts</span>}
      </div>

      {isLoading && !data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : data?.data.length ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Contact</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Tags</TableHead>
                <TableHead className="hidden sm:table-cell">Window</TableHead>
                <TableHead className="pr-4 text-right">Last interaction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer"
                  onClick={() => setOpen(contact.id)}
                  onKeyDown={(event) => event.key === "Enter" && setOpen(contact.id)}
                  tabIndex={0}
                >
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <ContactAvatar name={contact.display_name} platform={contact.platform} className="size-8" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate font-medium">
                          {contact.display_name}
                          {contact.is_simulated && <SimulatedBadge />}
                          {contact.unsubscribed && <span className="text-[0.65rem] font-medium text-destructive">Opted out</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{contact.username ? `@${contact.username}` : PLATFORM_LABELS[contact.platform]}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{contact.email ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {contact.tags?.slice(0, 3).map((item) => (
                        <span key={item.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
                          <span className="size-1.5 rounded-full" style={{ background: item.color }} />
                          {item.name}
                        </span>
                      ))}
                      {(contact.tags?.length ?? 0) > 3 && <span className="text-xs text-muted-foreground">+{(contact.tags?.length ?? 0) - 3}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className={cn("inline-flex items-center gap-1.5 text-xs", contact.messaging_window_open ? "text-success" : "text-muted-foreground")} title="24-hour messaging window">
                      <span className={cn("size-1.5 rounded-full", contact.messaging_window_open ? "bg-success" : "bg-muted-foreground/40")} />
                      {contact.messaging_window_open ? "Open" : "Closed"}
                    </span>
                  </TableCell>
                  <TableCell className="pr-4 text-right text-xs text-muted-foreground">{timeAgo(contact.last_interaction_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                Page {meta.current_page} of {meta.last_page}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon-sm" disabled={meta.current_page <= 1} onClick={() => setPage(meta.current_page - 1)} aria-label="Previous page">
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button variant="outline" size="icon-sm" disabled={meta.current_page >= meta.last_page} onClick={() => setPage(meta.current_page + 1)} aria-label="Next page">
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title={search || tag || platform || hasEmail ? "No contacts match these filters" : "No contacts yet"}
          description="Contacts are created automatically when someone comments on your posts or sends you a message."
        />
      )}

      <ContactSheet contactId={openId} onClose={() => setOpen(null)} onChanged={() => mutate()} />
    </>
  );
}
