/** Shapes returned by the Laravel API (backend/app/Http/Resources). */

export type Platform = "instagram" | "facebook" | "whatsapp" | "tiktok" | "email";
export type Role = "owner" | "admin" | "editor" | "agent" | "viewer";

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  timezone: string;
  default_language: "en" | "sw";
  settings: Record<string, unknown>;
  onboarded_at: string | null;
  role?: Role;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  current_workspace_id: number | null;
  workspaces?: Workspace[];
}

export interface Channel {
  id: number;
  platform: Platform;
  platform_label: string;
  capabilities: { comment_reply: boolean; private_reply: boolean; dm: boolean; templates: boolean };
  is_simulated: boolean;
  external_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  status: "connected" | "expired" | "error" | "disconnected";
  status_reason: string | null;
  scopes: string[];
  token_expires_at: string | null;
  last_webhook_at: string | null;
  posts_count?: number;
  created_at: string;
}

export interface Post {
  id: number;
  external_id: string;
  media_type: "reel" | "post" | "video" | "story";
  caption: string | null;
  permalink?: string | null;
  thumbnail_url?: string | null;
  published_at: string | null;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  contacts_count?: number;
}

export interface Contact {
  id: number;
  platform: Platform;
  channel_id: number | null;
  is_simulated: boolean;
  display_name: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  locale: string | null;
  custom_fields: Record<string, string>;
  unsubscribed: boolean;
  last_inbound_at: string | null;
  last_interaction_at: string | null;
  messaging_window_open: boolean;
  tags?: Pick<Tag, "id" | "name" | "color">[];
  created_at: string;
}

export type MessageStatus = "received" | "queued" | "sent" | "delivered" | "read" | "failed" | "blocked";

export interface Message {
  id: number;
  conversation_id: number | null;
  direction: "in" | "out";
  kind: "dm" | "comment" | "comment_reply" | "private_reply" | "template" | "note";
  source: "contact" | "automation" | "ai" | "user" | "system";
  body: string | null;
  payload: { text?: string; buttons?: { title: string; url: string }[]; postback?: string } | null;
  status: MessageStatus;
  error_message: string | null;
  is_simulated: boolean;
  automation_run_id: number | null;
  sender?: { id: number; name: string } | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  status: "open" | "closed" | "snoozed";
  is_simulated: boolean;
  needs_human: boolean;
  ai_paused: boolean;
  unread_count: number;
  last_message_preview: string | null;
  last_message_at: string | null;
  contact?: Contact;
  channel?: { id: number; name: string; username: string | null; platform: Platform; is_simulated: boolean };
  assignee?: { id: number; name: string } | null;
}

export type TriggerType = "comment_keyword" | "dm_keyword" | "story_reply" | "any_dm" | "postback";

export interface TriggerConfig {
  keywords?: string[];
  match?: "contains" | "exact" | "any";
  exclude_keywords?: string[];
  post_ids?: number[];
  channel_ids?: number[];
  once_per_contact?: boolean;
  skip_replies?: boolean;
}

export type NodeType =
  | "trigger"
  | "reply_comment"
  | "send_message"
  | "send_template"
  | "condition"
  | "split"
  | "delay"
  | "ai_reply"
  | "add_tag"
  | "remove_tag"
  | "set_field"
  | "collect_email"
  | "send_email"
  | "handover"
  | "end";

export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown> & { label?: string };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface Automation {
  id: number;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused";
  trigger_type: TriggerType;
  trigger_label: string;
  trigger_config: TriggerConfig;
  flow?: { nodes: FlowNode[]; edges: FlowEdge[] };
  priority: number;
  runs_count: number;
  completed_count: number;
  failed_count: number;
  last_run_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface AutomationTemplate {
  key: string;
  name: string;
  description: string;
  trigger_type: TriggerType;
}

export interface RunStep {
  id: number;
  node_id: string;
  node_type: NodeType;
  status: "completed" | "blocked" | "failed" | "waiting" | "skipped";
  summary: string | null;
  output: Record<string, unknown> | null;
  duration_ms: number;
  created_at: string;
}

export interface Run {
  id: number;
  automation_id: number;
  automation?: { id: number; name: string };
  contact?: Contact;
  is_simulated: boolean;
  status: "running" | "waiting" | "completed" | "failed" | "cancelled";
  current_node_id: string | null;
  waiting_for: "delay" | "reply" | "email" | null;
  resume_at: string | null;
  context: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  steps?: RunStep[];
}

export interface Paginated<T> {
  data: T[];
  meta?: { current_page: number; last_page: number; total: number; per_page: number };
  links?: Record<string, string | null>;
  current_page?: number;
  last_page?: number;
  total?: number;
}

export interface OverviewCounters {
  comments_processed: number;
  keyword_matches: number;
  messages_sent: number;
  messages_failed: number;
  messages_blocked: number;
  private_replies: number;
  messages_received: number;
  runs: number;
  new_contacts: number;
  leads_with_email: number;
  delivery_rate: number | null;
}

export interface Overview {
  range_days: number;
  totals: { channels: number; active_automations: number; contacts: number; open_conversations: number; needs_human: number };
  current: OverviewCounters;
  previous: OverviewCounters;
}

export interface TimeseriesPoint {
  date: string;
  comments: number;
  sent: number;
  failed: number;
  blocked: number;
  received: number;
  leads: number;
  runs: number;
}
