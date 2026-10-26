"use client";

import { useState } from "react";
import useSWR from "swr";
import { FileText, Mail, MailCheck, MailX, MoreHorizontal, Pencil, Plus, Send, Server, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { ConsentNote, CreateCampaignDialog, SendCampaignDialog } from "@/components/email/campaign-dialogs";
import { ProviderDialog } from "@/components/email/provider-dialog";
import { TemplateEditor } from "@/components/email/template-editor";
import type { EmailCampaign, EmailOverview, EmailProvider, EmailSend, LaravelPage } from "@/components/email/types";
import { ConfirmDialog, Pager } from "@/components/settings/form-kit";
import { useCan } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { compact, dateTime, timeAgo } from "@/lib/format";

export default function EmailPage() {
  const canManage = useCan("email.manage");
  const { data, mutate, isLoading } = useSWR<EmailOverview>("email");
  const [tab, setTab] = useState("campaigns");

  const [templateEditor, setTemplateEditor] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [providerDialog, setProviderDialog] = useState<{ open: boolean; provider: EmailProvider | null }>({ open: false, provider: null });
  const [createCampaign, setCreateCampaign] = useState(false);
  const [sending, setSending] = useState<EmailCampaign | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; action: () => Promise<void> } | null>(null);

  const refresh = () => mutate();

  return (
    <>
      <PageHeader
        title="Email"
        description="Deliver lead magnets and send consent-based campaigns to contacts you collected in conversations."
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={() => setTemplateEditor({ open: true, id: null })}>
                <FileText className="size-4" /> New template
              </Button>
              <Button onClick={() => (data?.templates.length ? setCreateCampaign(true) : toast.info("Create a template first."))}>
                <Send className="size-4" /> New campaign
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data ? (
          <>
            <StatCard label="Subscribers" value={compact(data.stats.subscribers)} icon={Users} hint="With marketing consent" />
            <StatCard label="Sent (30 days)" value={compact(data.stats.sent_30d)} icon={MailCheck} />
            <StatCard label="Failed (30 days)" value={compact(data.stats.failed_30d)} icon={MailX} />
            <StatCard label="Templates" value={data.templates.length} icon={FileText} hint={`${data.providers.length} provider${data.providers.length === 1 ? "" : "s"} connected`} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[106px] rounded-xl" />)
        )}
      </div>

      {data && data.providers.length === 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning/5 p-4 sm:flex-row sm:items-center">
          <Server className="size-5 shrink-0 text-warning" />
          <p className="flex-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">No email provider connected.</span> Emails use the server&apos;s default mailer until you connect SMTP. Simulated contacts never receive real email.
          </p>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setProviderDialog({ open: true, provider: null })}>
              Connect provider
            </Button>
          )}
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="mt-6">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          {isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : data?.campaigns.length ? (
            <div className="space-y-4">
              <ConsentNote />
              <div className="overflow-hidden rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Recipients</TableHead>
                      <TableHead className="text-right">Sent</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Skipped</TableHead>
                      <TableHead className="pr-5 text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="pl-5">
                          <div className="font-medium">{campaign.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {campaign.template?.name ?? "Template removed"} ·{" "}
                            {campaign.sent_at ? `sent ${timeAgo(campaign.sent_at)}` : campaign.scheduled_at ? `scheduled ${dateTime(campaign.scheduled_at)}` : `created ${timeAgo(campaign.created_at)}`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={campaign.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{campaign.recipients_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{campaign.sent_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{campaign.failed_count}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{campaign.skipped_count}</TableCell>
                        <TableCell className="pr-5 text-right">
                          {campaign.status === "draft" && canManage ? (
                            <Button size="sm" onClick={() => setSending(campaign)}>
                              <Send className="size-3.5" /> Review & send
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Send}
              title="No campaigns yet"
              description="Campaigns send a template to contacts who gave marketing consent, filtered by tags."
              action={
                canManage && (
                  <Button size="sm" onClick={() => (data?.templates.length ? setCreateCampaign(true) : setTemplateEditor({ open: true, id: null }))}>
                    <Plus className="size-3.5" /> {data?.templates.length ? "New campaign" : "Create a template first"}
                  </Button>
                )
              }
            />
          )}
        </TabsContent>

        <TabsContent value="templates">
          {data?.templates.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.templates.map((template) => (
                <div key={template.id} className="group flex flex-col rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Mail className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{template.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
                    </div>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Template actions" />}>
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setTemplateEditor({ open: true, id: template.id })}>
                            <Pencil className="size-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              setConfirm({
                                title: `Delete “${template.name}”?`,
                                action: async () => {
                                  await api.delete(`email/templates/${template.id}`);
                                  toast.success("Template deleted");
                                  refresh();
                                },
                              })
                            }
                          >
                            <Trash2 className="size-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <StatusBadge status={template.category} tone={template.category === "marketing" ? "brand" : "neutral"} />
                    <span>Updated {timeAgo(template.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No templates yet"
              description="Templates are reused by the “Send email” automation step and by campaigns."
              action={canManage && <Button size="sm" onClick={() => setTemplateEditor({ open: true, id: null })}><Plus className="size-3.5" /> New template</Button>}
            />
          )}
        </TabsContent>

        <TabsContent value="providers">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Sending providers</h2>
                <p className="text-xs text-muted-foreground">The default provider sends automation emails and campaigns without an explicit provider.</p>
              </div>
              {canManage && (
                <Button size="sm" onClick={() => setProviderDialog({ open: true, provider: null })}>
                  <Plus className="size-3.5" /> Add provider
                </Button>
              )}
            </div>
            {data?.providers.length ? (
              <ul className="divide-y">
                {data.providers.map((provider) => (
                  <li key={provider.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                      <Server className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {provider.name}
                        {provider.is_default && <StatusBadge status="default" tone="brand" />}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {provider.driver === "smtp" ? "SMTP" : "Log driver"} · {provider.from_name} &lt;{provider.from_email}&gt;
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        {!provider.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await Promise.all(data.providers.filter((item) => item.is_default).map((item) => api.patch(`email/providers/${item.id}`, { is_default: false })));
                                await api.patch(`email/providers/${provider.id}`, { is_default: true });
                                toast.success("Default provider updated");
                              } catch (error) {
                                toast.error((error as Error).message);
                              }
                              refresh();
                            }}
                          >
                            Make default
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" aria-label="Edit provider" onClick={() => setProviderDialog({ open: true, provider })}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove provider"
                          onClick={() =>
                            setConfirm({
                              title: `Remove ${provider.name}?`,
                              action: async () => {
                                await api.delete(`email/providers/${provider.id}`);
                                toast.success("Provider removed");
                                refresh();
                              },
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No providers yet. Connect SMTP to send real email.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <EmailActivity />
        </TabsContent>
      </Tabs>

      <TemplateEditor open={templateEditor.open} templateId={templateEditor.id} onOpenChange={(open) => setTemplateEditor((state) => ({ ...state, open }))} onSaved={refresh} />
      <ProviderDialog open={providerDialog.open} provider={providerDialog.provider} onOpenChange={(open) => setProviderDialog((state) => ({ ...state, open }))} onSaved={refresh} />
      <CreateCampaignDialog
        open={createCampaign}
        onOpenChange={setCreateCampaign}
        templates={data?.templates ?? []}
        providers={data?.providers ?? []}
        onCreated={(campaign) => {
          refresh();
          setSending(campaign);
        }}
      />
      <SendCampaignDialog campaign={sending} onOpenChange={(open) => !open && setSending(null)} onSent={refresh} />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.title ?? ""}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await confirm?.action();
          } catch (error) {
            toast.error((error as Error).message);
          }
        }}
      />
    </>
  );
}

function EmailActivity() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSWR<LaravelPage<EmailSend>>(`email/sends?page=${page}`);

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  if (!data?.data.length) {
    return <EmptyState icon={MailCheck} title="No emails sent yet" description="Every email sent by automations and campaigns is logged here, including skipped sends and why." />;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Recipient</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-5 text-right">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((send) => (
            <TableRow key={send.id}>
              <TableCell className="pl-5">
                <div className="font-medium">{send.to_email || "—"}</div>
                <div className="text-xs text-muted-foreground">{send.contact?.name ?? (send.contact?.username ? `@${send.contact.username}` : "")}</div>
              </TableCell>
              <TableCell className="max-w-[260px]">
                <div className="truncate">{send.subject}</div>
                {send.error && <div className="truncate text-xs text-muted-foreground" title={send.error}>{send.error}</div>}
              </TableCell>
              <TableCell>
                <StatusBadge status={send.status} />
              </TableCell>
              <TableCell className="pr-5 text-right text-xs text-muted-foreground">{timeAgo(send.sent_at ?? send.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pager page={data.current_page} lastPage={data.last_page} onChange={setPage} />
    </div>
  );
}
