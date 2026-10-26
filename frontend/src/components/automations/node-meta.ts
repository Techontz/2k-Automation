import {
  Bot,
  Clock,
  GitBranch,
  Hand,
  LayoutTemplate,
  MailPlus,
  MessageCircleReply,
  MessageSquare,
  PenLine,
  Send,
  Split,
  Square,
  Tag,
  TagsIcon,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { NodeType, TriggerType } from "@/lib/types";

export interface HandleSpec {
  id: string;
  label?: string;
  tone?: "default" | "success" | "danger" | "warning";
}

export interface NodeMeta {
  type: NodeType;
  label: string;
  description: string;
  group: "Trigger" | "Messages" | "Logic" | "Actions";
  icon: LucideIcon;
  /** Tailwind classes for the icon chip. */
  chip: string;
  defaults: Record<string, unknown>;
}

export const NODE_META: Record<NodeType, NodeMeta> = {
  trigger: { type: "trigger", label: "Trigger", description: "What starts this automation", group: "Trigger", icon: Zap, chip: "bg-brand text-white", defaults: {} },
  reply_comment: {
    type: "reply_comment",
    label: "Reply to comment",
    description: "Public reply under the comment",
    group: "Messages",
    icon: MessageCircleReply,
    chip: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
    defaults: { replies: ["Check your DMs {{first_name}}! 📩"] },
  },
  send_message: {
    type: "send_message",
    label: "Send message",
    description: "DM or private reply",
    group: "Messages",
    icon: Send,
    chip: "bg-brand-soft text-brand",
    defaults: { text: "Hey {{first_name}}! ", buttons: [], wait_for_reply: false, timeout_hours: 23 },
  },
  send_template: {
    type: "send_template",
    label: "WhatsApp template",
    description: "Approved template message",
    group: "Messages",
    icon: LayoutTemplate,
    chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    defaults: { template: "", language: "en", parameters: [] },
  },
  collect_email: {
    type: "collect_email",
    label: "Collect email",
    description: "Ask for an email and record consent",
    group: "Messages",
    icon: MailPlus,
    chip: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    defaults: {
      prompt: "Reply with your email and I'll send it over. We'll only use it to send this.",
      retry_prompt: "Hmm, that doesn't look like an email. Could you check it?",
      max_attempts: 2,
      marketing_opt_in: false,
      timeout_hours: 23,
    },
  },
  ai_reply: {
    type: "ai_reply",
    label: "AI reply",
    description: "Answer with your AI assistant",
    group: "Messages",
    icon: Bot,
    chip: "bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-400",
    defaults: { instructions: "" },
  },
  condition: {
    type: "condition",
    label: "Condition",
    description: "Branch on contact data",
    group: "Logic",
    icon: GitBranch,
    chip: "bg-amber-500/14 text-amber-700 dark:text-amber-400",
    defaults: { match: "all", rules: [{ field: "email", operator: "exists", value: "" }] },
  },
  split: {
    type: "split",
    label: "A/B split",
    description: "Randomly split traffic",
    group: "Logic",
    icon: Split,
    chip: "bg-amber-500/14 text-amber-700 dark:text-amber-400",
    defaults: { percent_a: 50 },
  },
  delay: {
    type: "delay",
    label: "Delay",
    description: "Wait before continuing",
    group: "Logic",
    icon: Clock,
    chip: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
    defaults: { amount: 5, unit: "minutes" },
  },
  add_tag: { type: "add_tag", label: "Add tag", description: "Tag the contact", group: "Actions", icon: Tag, chip: "bg-teal-500/12 text-teal-600 dark:text-teal-400", defaults: { tag: "" } },
  remove_tag: { type: "remove_tag", label: "Remove tag", description: "Remove a tag", group: "Actions", icon: TagsIcon, chip: "bg-teal-500/12 text-teal-600 dark:text-teal-400", defaults: { tag: "" } },
  set_field: { type: "set_field", label: "Set field", description: "Save a custom field", group: "Actions", icon: PenLine, chip: "bg-teal-500/12 text-teal-600 dark:text-teal-400", defaults: { key: "", value: "" } },
  send_email: { type: "send_email", label: "Send email", description: "Send an email template", group: "Actions", icon: MessageSquare, chip: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400", defaults: { template_id: null } },
  handover: { type: "handover", label: "Hand over", description: "Assign to your team", group: "Actions", icon: Hand, chip: "bg-rose-500/12 text-rose-600 dark:text-rose-400", defaults: { note: "" } },
  end: { type: "end", label: "End", description: "Stop the flow", group: "Actions", icon: Square, chip: "bg-muted text-muted-foreground", defaults: {} },
};

export const PALETTE_GROUPS: { label: NodeMeta["group"]; types: NodeType[] }[] = [
  { label: "Messages", types: ["reply_comment", "send_message", "send_template", "collect_email", "ai_reply"] },
  { label: "Logic", types: ["condition", "split", "delay"] },
  { label: "Actions", types: ["add_tag", "remove_tag", "set_field", "send_email", "handover", "end"] },
];

export const TRIGGER_OPTIONS: { value: TriggerType; label: string; hint: string }[] = [
  { value: "comment_keyword", label: "Comment contains keyword", hint: "Instagram & Facebook comments on your posts and Reels" },
  { value: "dm_keyword", label: "Direct message contains keyword", hint: "Incoming DMs matching a keyword" },
  { value: "story_reply", label: "Story reply", hint: "Someone replies to your Instagram story" },
  { value: "any_dm", label: "Any incoming message", hint: "Every DM not handled by another automation" },
  { value: "postback", label: "Button clicked", hint: "Quick reply / button payload" },
];

/** Outgoing handles for a node, given its current data. */
export function handlesFor(type: NodeType, data: Record<string, unknown>): HandleSpec[] {
  switch (type) {
    case "end":
      return [];
    case "condition":
      return [
        { id: "true", label: "Yes", tone: "success" },
        { id: "false", label: "No", tone: "danger" },
      ];
    case "split":
      return [
        { id: "a", label: `A · ${Number(data.percent_a ?? 50)}%` },
        { id: "b", label: `B · ${100 - Number(data.percent_a ?? 50)}%` },
      ];
    case "ai_reply":
      return [{ id: "default", label: "Replied" }, { id: "handover", label: "Handover", tone: "warning" }];
    case "collect_email":
      return [{ id: "default", label: "Got email", tone: "success" }, { id: "invalid", label: "No email", tone: "danger" }];
    case "send_message":
      return data.wait_for_reply ? [{ id: "default", label: "Replied" }, { id: "timeout", label: "No reply", tone: "warning" }] : [{ id: "default" }];
    default:
      return [{ id: "default" }];
  }
}

function truncate(value: unknown, length = 70): string {
  const text = String(value ?? "").trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

/** One-line human summary of a node's configuration. */
export function summarize(type: NodeType, data: Record<string, unknown>, triggerSummary?: string): string {
  switch (type) {
    case "trigger":
      return triggerSummary ?? "Configure the trigger";
    case "reply_comment": {
      const replies = ((data.replies as string[]) ?? []).filter(Boolean);
      return replies.length ? `${truncate(replies[0], 50)}${replies.length > 1 ? ` +${replies.length - 1} variants` : ""}` : "Add reply text";
    }
    case "send_message": {
      const buttons = (data.buttons as unknown[])?.length ?? 0;
      return truncate(data.text) || "Write a message" + (buttons ? ` · ${buttons} button${buttons > 1 ? "s" : ""}` : "");
    }
    case "send_template":
      return data.template ? `Template “${data.template}” (${data.language ?? "en"})` : "Choose a template";
    case "collect_email":
      return truncate(data.prompt) || "Ask for an email";
    case "ai_reply":
      return data.instructions ? truncate(data.instructions) : "Uses your AI assistant settings";
    case "condition": {
      const rules = (data.rules as { field: string; operator: string; value?: string }[]) ?? [];
      if (!rules.length) return "Always true";
      const first = rules[0];
      return `${first.field} ${first.operator.replace("_", " ")}${first.value ? ` “${first.value}”` : ""}${rules.length > 1 ? ` ${data.match === "any" ? "or" : "and"} ${rules.length - 1} more` : ""}`;
    }
    case "split":
      return `${Number(data.percent_a ?? 50)}% A / ${100 - Number(data.percent_a ?? 50)}% B`;
    case "delay":
      return `Wait ${data.amount ?? 1} ${data.unit ?? "minutes"}`;
    case "add_tag":
    case "remove_tag":
      return data.tag ? `“${data.tag}”` : "Choose a tag";
    case "set_field":
      return data.key ? `${data.key} = ${truncate(data.value, 30) || "…"}` : "Choose a field";
    case "send_email":
      return data.template_name ? `“${data.template_name}”` : data.template_id ? `Template #${data.template_id}` : "Choose a template";
    case "handover":
      return data.note ? truncate(data.note) : "Flag for a teammate, pause AI";
    case "end":
      return "Flow ends here";
  }
}
