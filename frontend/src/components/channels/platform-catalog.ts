import type { Platform } from "@/lib/types";

export interface PlatformInfo {
  platform: Platform;
  title: string;
  connect: "oauth" | "whatsapp" | "email";
  capabilities: string[];
  restriction: string;
}

/** What each official API lets us do — mirrors docs/PLATFORM_COMPLIANCE.md. */
export const PLATFORMS: PlatformInfo[] = [
  {
    platform: "instagram",
    title: "Instagram",
    connect: "oauth",
    capabilities: ["Keyword triggers on posts & Reels", "Public comment replies", "One private reply per comment", "DMs within 24h of their last message"],
    restriction: "Requires a Business or Creator account. Private replies must be sent within 7 days of the comment, and further DMs need the person to reply first.",
  },
  {
    platform: "facebook",
    title: "Facebook Messenger",
    connect: "oauth",
    capabilities: ["Page comment triggers", "Public & private replies", "Messenger DMs in the 24h window", "Human agent replies up to 7 days"],
    restriction: "Connect the Facebook Pages you manage. Promotional messages outside the 24-hour window are not allowed.",
  },
  {
    platform: "whatsapp",
    title: "WhatsApp Business",
    connect: "whatsapp",
    capabilities: ["Inbound message triggers", "Free-form replies within 24h", "Approved templates outside 24h", "CTA URL buttons"],
    restriction: "Uses the Cloud API. Outside the 24-hour customer service window you can only send pre-approved templates.",
  },
  {
    platform: "tiktok",
    title: "TikTok",
    connect: "oauth",
    capabilities: ["List your videos", "Reply to comments on your own videos"],
    restriction: "TikTok does not offer DMs or private replies to third-party apps. Use a public reply that points to your link in bio, Instagram or WhatsApp.",
  },
  {
    platform: "email",
    title: "Email",
    connect: "email",
    capabilities: ["SMTP providers (SES, Resend, Postmark, Mailgun)", "Templates & campaigns", "Consent-checked sends", "One-click unsubscribe"],
    restriction: "Only contacts with recorded consent receive email. Every message includes an unsubscribe link.",
  },
];
