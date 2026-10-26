"use client";

import useSWR from "swr";
import { CheckCircle2, Circle, Webhook } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlatformIcon } from "@/components/app/platform-icon";
import { SimulatedBadge, StatusBadge } from "@/components/app/status-badge";
import { timeAgo } from "@/lib/format";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CopyField, SectionCard } from "./form-kit";

interface Integrations {
  webhook_urls: Record<"meta" | "tiktok" | "oauth_instagram" | "oauth_facebook" | "oauth_tiktok", string>;
  configured: {
    meta_app: boolean;
    meta_verify_token: boolean;
    instagram_app: boolean;
    whatsapp_embedded_signup: boolean;
    tiktok_app: boolean;
    anthropic: boolean;
    openai: boolean;
    queue_driver: string;
    graph_version: string;
  };
  webhook_health: {
    last_24h: number;
    failed_24h: number;
    by_status: Record<string, number>;
    recent: {
      id: number;
      platform: Platform;
      event_type: string | null;
      status: string;
      outcome: string | null;
      error: string | null;
      is_simulated: boolean;
      attempts: number;
      created_at: string;
    }[];
  };
}

const CHECKS: { key: keyof Integrations["configured"]; label: string; env: string }[] = [
  { key: "instagram_app", label: "Instagram app (Instagram Login)", env: "INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET" },
  { key: "meta_app", label: "Meta app (Messenger & WhatsApp)", env: "META_APP_ID / META_APP_SECRET" },
  { key: "meta_verify_token", label: "Webhook verify token", env: "META_WEBHOOK_VERIFY_TOKEN" },
  { key: "whatsapp_embedded_signup", label: "WhatsApp Embedded Signup", env: "WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID" },
  { key: "tiktok_app", label: "TikTok for Business app", env: "TIKTOK_APP_ID / TIKTOK_APP_SECRET" },
  { key: "anthropic", label: "Anthropic API key (platform)", env: "ANTHROPIC_API_KEY" },
  { key: "openai", label: "OpenAI API key (platform)", env: "OPENAI_API_KEY" },
];

export function IntegrationsTab() {
  const { data } = useSWR<Integrations>("settings/integrations", { refreshInterval: 30000 });

  if (!data) return <Skeleton className="h-96 rounded-xl" />;

  const health = data.webhook_health;
  const failureRate = health.last_24h ? Math.round((health.failed_24h / health.last_24h) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Endpoints" description="Paste these into the Meta and TikTok developer dashboards.">
          <div className="space-y-3">
            <CopyField label="Meta webhook callback URL (Instagram, Messenger, WhatsApp)" value={data.webhook_urls.meta} />
            <CopyField label="TikTok webhook URL" value={data.webhook_urls.tiktok} />
            <CopyField label="Instagram OAuth redirect URI" value={data.webhook_urls.oauth_instagram} />
            <CopyField label="Facebook OAuth redirect URI" value={data.webhook_urls.oauth_facebook} />
            <CopyField label="TikTok OAuth redirect URI" value={data.webhook_urls.oauth_tiktok} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Meta requires public HTTPS URLs. For local testing use a tunnel such as ngrok or Cloudflare Tunnel and set APP_URL accordingly.</p>
        </SectionCard>

        <SectionCard title="Configuration" description="Set in backend/.env. Secrets are never displayed here.">
          <ul className="space-y-2.5">
            {CHECKS.map((check) => {
              const ok = Boolean(data.configured[check.key]);
              return (
                <li key={check.key} className="flex items-start gap-2.5">
                  {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />}
                  <div className="min-w-0">
                    <p className={cn("text-sm", !ok && "text-muted-foreground")}>{check.label}</p>
                    <p className="font-mono text-[0.7rem] text-muted-foreground">{check.env}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-xs">
            <div>
              <dt className="text-muted-foreground">Queue driver</dt>
              <dd className="mt-0.5 font-mono">{data.configured.queue_driver}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Graph API version</dt>
              <dd className="mt-0.5 font-mono">{data.configured.graph_version}</dd>
            </div>
          </dl>
          {data.configured.queue_driver === "sync" && <p className="mt-3 text-xs text-warning">The sync queue processes webhooks inline. Use Redis with queue workers in production.</p>}
        </SectionCard>
      </div>

      <SectionCard title="Webhook health" description="Events received in the last 24 hours, including simulated ones." bodyClassName="p-0">
        <div className="grid grid-cols-3 divide-x border-b">
          <Metric label="Events" value={health.last_24h} />
          <Metric label="Failed" value={health.failed_24h} tone={health.failed_24h ? "text-destructive" : undefined} />
          <Metric label="Failure rate" value={`${failureRate}%`} tone={failureRate > 5 ? "text-destructive" : undefined} />
        </div>
        {health.recent.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <Webhook className="mb-2 size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No webhook events yet. Run a simulation or connect a channel.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Outcome</TableHead>
                <TableHead className="pr-5 text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {health.recent.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={event.platform} className="size-6 rounded-md" />
                      <span className="capitalize">{event.event_type ?? "event"}</span>
                      {event.is_simulated && <SimulatedBadge />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={event.status} />
                    {event.attempts > 1 && <span className="ml-1.5 text-[0.7rem] text-muted-foreground">{event.attempts} attempts</span>}
                  </TableCell>
                  <TableCell className="hidden max-w-[360px] md:table-cell">
                    <span className={cn("block truncate text-xs", event.error ? "text-destructive" : "text-muted-foreground")} title={event.error ?? event.outcome ?? ""}>
                      {event.error ?? event.outcome ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="pr-5 text-right text-xs text-muted-foreground">{timeAgo(event.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", tone)}>{value}</div>
    </div>
  );
}
