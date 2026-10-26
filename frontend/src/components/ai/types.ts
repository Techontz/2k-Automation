/** AI module shapes (backend/app/Http/Controllers/Api/V1/AiController.php). */

export interface AiSettings {
  id: number;
  enabled: boolean;
  provider: "anthropic" | "openai";
  model: string | null;
  assistant_name: string;
  brand_voice: string | null;
  languages: ("en" | "sw")[];
  confidence_threshold: number;
  handover_keywords: string[] | null;
  extra_instructions: string | null;
  auto_reply_dms: boolean;
}

export interface KnowledgeItem {
  id: number;
  title: string;
  content: string;
  enabled: boolean;
  updated_at: string;
}

export interface AiOverview {
  settings: AiSettings;
  has_workspace_key: boolean;
  platform_keys: { anthropic: boolean; openai: boolean };
  default_models: { anthropic: string; openai: string };
  knowledge: KnowledgeItem[];
}

export interface AiTestResult {
  reply: string;
  confidence: number;
  language: string;
  handover: boolean;
  reason: string | null;
  provider: string;
}
