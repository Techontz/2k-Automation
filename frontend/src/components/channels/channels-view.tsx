"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Check, Info, Loader2, Plug, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PlatformIcon } from "@/components/app/platform-icon";
import { useCan } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api";
import type { Channel, Platform } from "@/lib/types";
import { ChannelRow } from "./channel-row";
import { NotConfiguredDialog, WhatsAppDialog, type NotConfigured } from "./connect-dialogs";
import { PLATFORMS, type PlatformInfo } from "./platform-catalog";

export function ChannelsView() {
  const router = useRouter();
  const params = useSearchParams();
  const canManage = useCan("channels.manage");
  const { data, mutate } = useSWR<{ data: Channel[] }>("channels");
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [notConfigured, setNotConfigured] = useState<NotConfigured | null>(null);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const handledParams = useRef(false);

  useEffect(() => {
    if (handledParams.current) return;
    const connected = params.get("connected");
    const error = params.get("error");
    if (!connected && !error) return;
    handledParams.current = true;
    if (connected) {
      const count = Number(params.get("count") ?? 1);
      toast.success(`${PLATFORMS.find((item) => item.platform === connected)?.title ?? connected} connected${count > 1 ? ` (${count} accounts)` : ""}.`);
    }
    if (error) toast.error(error);
    router.replace("/channels");
  }, [params, router]);

  async function connect(info: PlatformInfo) {
    if (info.connect === "email") {
      router.push("/email");
      return;
    }
    if (info.connect === "whatsapp") {
      setWhatsAppOpen(true);
      return;
    }

    setConnecting(info.platform);
    try {
      const { url } = await api.post<{ url: string }>(`channels/connect/${info.platform}`);
      window.location.assign(url);
    } catch (error) {
      setConnecting(null);
      if (error instanceof ApiError && error.data.code === "integration_not_configured") {
        setNotConfigured({ platform: info.title, missing: (error.data.missing as string[]) ?? [], redirect_uri: error.data.redirect_uri as string | undefined });
      } else {
        toast.error((error as Error).message);
      }
    }
  }

  const channels = data?.data ?? [];
  const connectedPlatforms = new Set(channels.filter((channel) => !channel.is_simulated && channel.status === "connected").map((channel) => channel.platform));

  return (
    <>
      <PageHeader
        title="Channels"
        description="Connect your accounts through each platform's official API. We never ask for passwords and never use unofficial methods."
      />

      <section className="mb-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PLATFORMS.map((info) => {
            const connected = connectedPlatforms.has(info.platform);
            return (
              <div key={info.platform} className="flex flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-[0_4px_20px_-10px_rgba(20,20,40,0.2)]">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={info.platform} className="size-10 rounded-xl" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold">{info.title}</h3>
                    <p className="text-xs text-muted-foreground">{info.platform === "email" ? "Workspace email provider" : "Official API"}</p>
                  </div>
                  {connected && (
                    <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[0.7rem] font-medium text-success">
                      <Check className="size-3" /> Connected
                    </span>
                  )}
                </div>
                <ul className="mt-4 space-y-1.5">
                  {info.capabilities.map((capability) => (
                    <li key={capability} className="flex items-start gap-2 text-[0.8rem]">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-brand" /> {capability}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" /> {info.restriction}
                </p>
                <div className="mt-auto pt-4">
                  {info.connect === "email" ? (
                    <Link href="/email" className={buttonVariants({ variant: "outline", className: "w-full" })}>Configure email</Link>
                  ) : (
                    <Button
                      className="w-full"
                      variant={connected ? "outline" : "default"}
                      disabled={!canManage || connecting !== null}
                      onClick={() => connect(info)}
                    >
                      {connecting === info.platform ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
                      {connected ? "Connect another" : `Connect ${info.title.split(" ")[0]}`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!canManage && <p className="mt-3 text-xs text-muted-foreground">Only workspace admins can connect or disconnect channels.</p>}
      </section>

      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold">Connected accounts</h2>
            <p className="text-xs text-muted-foreground">Tokens are encrypted at rest and refreshed automatically before they expire.</p>
          </div>
          <ShieldCheck className="size-4 text-success" />
        </div>
        {!data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-14" />)}
          </div>
        ) : channels.length === 0 ? (
          <EmptyState className="m-5" icon={Plug} title="No channels yet" description="Connect Instagram to start automating comments and DMs, or try the simulator first." />
        ) : (
          <div className="divide-y">
            {channels.map((channel) => (
              <ChannelRow key={channel.id} channel={channel} canManage={canManage} onChanged={() => mutate()} />
            ))}
          </div>
        )}
      </section>

      <NotConfiguredDialog info={notConfigured} onClose={() => setNotConfigured(null)} />
      <WhatsAppDialog open={whatsAppOpen} onOpenChange={setWhatsAppOpen} onConnected={() => mutate()} onNotConfigured={setNotConfigured} />
    </>
  );
}
