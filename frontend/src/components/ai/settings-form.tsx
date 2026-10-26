"use client";

import { useMemo, useState } from "react";
import { KeyRound, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField, NativeSelect, SaveBar, SectionCard } from "@/components/settings/form-kit";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AiOverview, AiSettings } from "./types";

type Draft = Omit<AiSettings, "id"> & { api_key: string };

function toDraft(settings: AiSettings): Draft {
  return {
    enabled: settings.enabled,
    provider: settings.provider,
    model: settings.model ?? "",
    assistant_name: settings.assistant_name,
    brand_voice: settings.brand_voice ?? "",
    languages: settings.languages ?? ["en"],
    confidence_threshold: Number(settings.confidence_threshold),
    handover_keywords: settings.handover_keywords ?? [],
    extra_instructions: settings.extra_instructions ?? "",
    auto_reply_dms: settings.auto_reply_dms,
    api_key: "",
  };
}

export function AiSettingsForm({ overview, canManage, onSaved }: { overview: AiOverview; canManage: boolean; onSaved: () => void }) {
  const initial = useMemo(() => toDraft(overview.settings), [overview.settings]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [keyword, setKeyword] = useState("");
  const [pending, setPending] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const platformKey = overview.platform_keys[draft.provider];
  const keyStatus = overview.has_workspace_key
    ? { label: "Using your workspace key", tone: "text-success", detail: "Stored encrypted. Enter a new key to replace it." }
    : platformKey
      ? { label: "Using the platform key", tone: "text-success", detail: "Provided by this 2K Automation installation." }
      : { label: "No key — built-in knowledge-base matcher", tone: "text-warning", detail: "Answers by matching your knowledge base. Add a key for natural AI replies." };

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addKeyword() {
    const value = keyword.trim().toLowerCase();
    if (value && !draft.handover_keywords?.includes(value)) update("handover_keywords", [...(draft.handover_keywords ?? []), value]);
    setKeyword("");
  }

  async function save() {
    setPending(true);
    const { api_key, ...rest } = draft;
    try {
      await api.patch("ai", { ...rest, model: rest.model || null, ...(api_key ? { api_key } : {}) });
      toast.success("AI assistant saved");
      onSaved();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function removeKey() {
    try {
      await api.patch("ai", { api_key: "" });
      toast.success("Workspace key removed");
      onSaved();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const disabled = !canManage;

  return (
    <div className="space-y-6">
      <SectionCard title="Assistant" description="Turn the assistant on for AI flow steps, inbox suggestions and automatic DM replies.">
        <div className="space-y-4">
          <ToggleRow
            title="Enable AI assistant"
            description="Required for AI reply steps in automations."
            checked={draft.enabled}
            onChange={(value) => update("enabled", value)}
            disabled={disabled}
          />
          <ToggleRow
            title="Auto-reply to direct messages"
            description="Answer DMs that no automation handled. Low-confidence questions are handed to your team."
            checked={draft.auto_reply_dms}
            onChange={(value) => update("auto_reply_dms", value)}
            disabled={disabled || !draft.enabled}
          />
        </div>
      </SectionCard>

      <SectionCard title="Model provider" description="Bring your own key or use the platform key. Keys are encrypted and never shown again.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Provider" htmlFor="ai-provider">
            <NativeSelect id="ai-provider" value={draft.provider} onChange={(event) => update("provider", event.target.value as Draft["provider"])} disabled={disabled}>
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI</option>
            </NativeSelect>
          </FormField>
          <FormField label="Model" htmlFor="ai-model" hint="Leave empty to use the default.">
            <Input id="ai-model" value={draft.model ?? ""} onChange={(event) => update("model", event.target.value)} placeholder={overview.default_models[draft.provider]} disabled={disabled} />
          </FormField>
          <FormField label="Workspace API key" htmlFor="ai-key" className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                id="ai-key"
                type="password"
                autoComplete="off"
                value={draft.api_key}
                onChange={(event) => update("api_key", event.target.value)}
                placeholder={overview.has_workspace_key ? "•••••••••••••••• (saved)" : draft.provider === "anthropic" ? "sk-ant-…" : "sk-…"}
                disabled={disabled}
              />
              {overview.has_workspace_key && canManage && (
                <button type="button" onClick={removeKey} className="shrink-0 rounded-lg border px-3 text-xs text-muted-foreground hover:text-destructive">
                  Remove
                </button>
              )}
            </div>
          </FormField>
        </div>
        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-muted/50 p-3">
          <KeyRound className={cn("mt-0.5 size-4 shrink-0", keyStatus.tone)} />
          <div className="text-xs">
            <p className={cn("font-medium", keyStatus.tone)}>{keyStatus.label}</p>
            <p className="text-muted-foreground">{keyStatus.detail}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Brand voice & behaviour" description="How the assistant sounds and when it steps aside for a human.">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Assistant name" htmlFor="ai-name">
              <Input id="ai-name" value={draft.assistant_name} onChange={(event) => update("assistant_name", event.target.value)} disabled={disabled} />
            </FormField>
            <FormField label="Reply languages" hint="Replies match the customer's language.">
              <div className="flex h-9 items-center gap-5">
                {(
                  [
                    ["en", "English"],
                    ["sw", "Swahili"],
                  ] as const
                ).map(([code, label]) => (
                  <label key={code} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.languages.includes(code)}
                      disabled={disabled || (draft.languages.length === 1 && draft.languages.includes(code))}
                      onCheckedChange={(checked) => update("languages", checked ? [...draft.languages, code] : draft.languages.filter((item) => item !== code))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </FormField>
          </div>

          <FormField label="Brand voice" htmlFor="ai-voice" hint="Example: Warm, upbeat and concise. Uses emojis sparingly. Calls customers by first name.">
            <Textarea id="ai-voice" value={draft.brand_voice ?? ""} onChange={(event) => update("brand_voice", event.target.value)} className="min-h-20" disabled={disabled} />
          </FormField>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="ai-threshold" className="text-sm font-medium">Confidence threshold</label>
              <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-brand">{Math.round(draft.confidence_threshold * 100)}%</span>
            </div>
            <input
              id="ai-threshold"
              type="range"
              min={0.3}
              max={0.95}
              step={0.05}
              value={draft.confidence_threshold}
              onChange={(event) => update("confidence_threshold", Number(event.target.value))}
              disabled={disabled}
              className="w-full accent-[var(--brand)]"
            />
            <div className="mt-1 flex justify-between text-[0.7rem] text-muted-foreground">
              <span>Answers more often</span>
              <span>Hands over more often</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Replies below this confidence are not sent — the conversation is flagged for a human instead.</p>
          </div>

          <FormField label="Handover keywords" hint="If a message contains any of these, the assistant hands over immediately.">
            <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5">
              {draft.handover_keywords?.map((item) => (
                <span key={item} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                  {item}
                  {!disabled && (
                    <button type="button" aria-label={`Remove ${item}`} onClick={() => update("handover_keywords", draft.handover_keywords?.filter((value) => value !== item) ?? [])}>
                      <X className="size-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </span>
              ))}
              {!disabled && (
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      addKeyword();
                    }
                  }}
                  onBlur={addKeyword}
                  placeholder="Add keyword…"
                  className="min-w-28 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              )}
            </div>
          </FormField>

          <FormField label="Extra instructions" htmlFor="ai-extra" hint="Business rules, e.g. “Never discuss competitor pricing. Mention free delivery over TZS 50,000.”">
            <Textarea id="ai-extra" value={draft.extra_instructions ?? ""} onChange={(event) => update("extra_instructions", event.target.value)} className="min-h-20" disabled={disabled} />
          </FormField>
        </div>
      </SectionCard>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-brand" /> The assistant only states facts from your knowledge base and never asks for passwords or card details.
      </p>

      {canManage && <SaveBar dirty={dirty} pending={pending} onSave={save} onReset={() => setDraft(initial)} />}
    </div>
  );
}

function ToggleRow({ title, description, checked, onChange, disabled }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4", disabled && "cursor-not-allowed opacity-60")}>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} disabled={disabled} className="mt-0.5" />
    </label>
  );
}
