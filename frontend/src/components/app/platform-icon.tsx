import { Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/types";

const STYLES: Record<Platform, string> = {
  instagram: "bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white",
  facebook: "bg-[#0866ff] text-white",
  whatsapp: "bg-[#25d366] text-white",
  tiktok: "bg-black text-white dark:bg-white dark:text-black",
  email: "bg-muted text-foreground",
};

function Glyph({ platform }: { platform: Platform }) {
  switch (platform) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-[60%]">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
        </svg>
      );
    case "facebook":
      return <MessageCircle className="size-[58%]" />;
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-[60%]">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.7-2.7-1.1-4.4-3.8-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-[58%]">
          <path d="M16.6 3c.4 2 1.6 3.4 3.6 3.6v3a7 7 0 0 1-3.6-1.1v6.3A5.8 5.8 0 1 1 10.8 9v3.1a2.8 2.8 0 1 0 2.8 2.8V3h3Z" />
        </svg>
      );
    default:
      return <Mail className="size-[58%]" />;
  }
}

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-lg", STYLES[platform], className)}>
      <Glyph platform={platform} />
    </span>
  );
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Messenger",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  email: "Email",
};
