"use client";

import { useState } from "react";
import useSWR from "swr";
import { FileClock, KeyRound, Lock, ShieldCheck, Webhook } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/app/empty-state";
import { dateTime } from "@/lib/format";
import { Pager, SectionCard } from "./form-kit";

interface AuditEntry {
  id: number;
  action: string;
  subject_type: string | null;
  subject_id: number | null;
  properties: Record<string, unknown> | string[] | null;
  ip_address: string | null;
  created_at: string;
  user: { id: number; name: string; email: string } | null;
}

interface AuditPage {
  data: AuditEntry[];
  current_page: number;
  last_page: number;
}

const PRACTICES = [
  { icon: KeyRound, title: "Encrypted tokens", text: "Platform access tokens, SMTP passwords and AI keys are encrypted at rest with your APP_KEY." },
  { icon: Lock, title: "httpOnly sessions", text: "Your session token lives in an httpOnly cookie and never reaches browser JavaScript." },
  { icon: Webhook, title: "Signed webhooks", text: "Every Meta and TikTok webhook is verified with HMAC-SHA256 and deduplicated before processing." },
  { icon: ShieldCheck, title: "Policy-gated messaging", text: "Each outbound message passes platform rules: 24-hour windows, one private reply per comment, consent for email." },
];

function describe(entry: AuditEntry): string {
  const subject = entry.subject_type ? `${entry.subject_type.split("\\").pop()} #${entry.subject_id}` : "";
  return subject;
}

export function SecurityTab({ canView }: { canView: boolean }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSWR<AuditPage>(canView ? `settings/audit-logs?page=${page}` : null);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PRACTICES.map((practice) => (
          <div key={practice.title} className="rounded-xl border bg-card p-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <practice.icon className="size-4" />
            </span>
            <p className="mt-3 text-sm font-medium">{practice.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{practice.text}</p>
          </div>
        ))}
      </div>

      <SectionCard title="Audit log" description="Sign-ins, connections, automation changes, exports and consent updates." bodyClassName="p-0">
        {!canView ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">Only admins and owners can view the audit log.</p>
        ) : isLoading ? (
          <div className="p-5">
            <Skeleton className="h-40" />
          </div>
        ) : !data?.data.length ? (
          <EmptyState className="m-5 border-none" icon={FileClock} title="No activity recorded yet" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Subject</TableHead>
                  <TableHead className="hidden lg:table-cell">IP</TableHead>
                  <TableHead className="pr-5 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="pl-5">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">{entry.action}</code>
                    </TableCell>
                    <TableCell className="text-sm">{entry.user?.name ?? <span className="text-muted-foreground">System</span>}</TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">{describe(entry) || "—"}</TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">{entry.ip_address ?? "—"}</TableCell>
                    <TableCell className="pr-5 text-right text-xs text-muted-foreground">{dateTime(entry.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={data.current_page} lastPage={data.last_page} onChange={setPage} />
          </>
        )}
      </SectionCard>
    </div>
  );
}
