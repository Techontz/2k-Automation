/** Email module shapes (backend/app/Http/Controllers/Api/V1/EmailController.php). */

export interface EmailProvider {
  id: number;
  driver: "smtp" | "log";
  name: string;
  from_name: string;
  from_email: string;
  is_default: boolean;
  status: string;
  created_at: string;
}

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  category: "marketing" | "transactional";
  body_html?: string;
  body_text?: string | null;
  updated_at: string;
}

export interface EmailCampaign {
  id: number;
  name: string;
  email_template_id: number;
  email_provider_id: number | null;
  audience: { tag_ids?: number[] } | null;
  status: "draft" | "scheduled" | "sending" | "sent";
  scheduled_at: string | null;
  sent_at: string | null;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  template?: { id: number; name: string } | null;
  created_at: string;
}

export interface EmailSend {
  id: number;
  to_email: string;
  subject: string;
  status: "queued" | "sent" | "failed" | "skipped";
  error: string | null;
  sent_at: string | null;
  created_at: string;
  email_campaign_id: number | null;
  contact?: { id: number; username: string | null; name: string | null; email: string | null } | null;
}

export interface EmailOverview {
  providers: EmailProvider[];
  templates: EmailTemplate[];
  campaigns: EmailCampaign[];
  stats: { sent_30d: number; failed_30d: number; subscribers: number };
}

export interface LaravelPage<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}
