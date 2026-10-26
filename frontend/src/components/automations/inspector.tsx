"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Channel, NodeType, Post, Tag, TriggerConfig, TriggerType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChipsInput, Field, NativeSelect, PolicyHint, SwitchRow, VariableHints } from "./fields";
import type { BuilderNode } from "./flow-node";
import { NODE_META, TRIGGER_OPTIONS } from "./node-meta";

type Data = Record<string, unknown>;

export interface InspectorProps {
  node: BuilderNode;
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
  readOnly: boolean;
  onChange: (patch: Data) => void;
  onTriggerChange: (type: TriggerType, config: TriggerConfig) => void;
  onDelete: () => void;
}

export function Inspector({ node, triggerType, triggerConfig, readOnly, onChange, onTriggerChange, onDelete }: InspectorProps) {
  const meta = NODE_META[node.type as NodeType];
  const Icon = meta.icon;
  const data = node.data as Data;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b px-4 py-3.5">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", meta.chip)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{meta.label}</p>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
        {node.type !== "trigger" && !readOnly && (
          <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete step" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <fieldset disabled={readOnly} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin">
        {node.type !== "trigger" && (
          <Field label="Step name">
            <Input value={String(data.label ?? "")} placeholder={meta.label} onChange={(event) => onChange({ label: event.target.value })} />
          </Field>
        )}
        <NodeForm type={node.type as NodeType} data={data} onChange={onChange} triggerType={triggerType} triggerConfig={triggerConfig} onTriggerChange={onTriggerChange} readOnly={readOnly} />
      </fieldset>
    </div>
  );
}

function NodeForm({
  type,
  data,
  onChange,
  triggerType,
  triggerConfig,
  onTriggerChange,
  readOnly,
}: {
  type: NodeType;
  data: Data;
  onChange: (patch: Data) => void;
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
  onTriggerChange: (type: TriggerType, config: TriggerConfig) => void;
  readOnly: boolean;
}) {
  switch (type) {
    case "trigger":
      return <TriggerForm type={triggerType} config={triggerConfig} onChange={onTriggerChange} readOnly={readOnly} />;
    case "reply_comment":
      return <ReplyCommentForm data={data} onChange={onChange} />;
    case "send_message":
      return <SendMessageForm data={data} onChange={onChange} />;
    case "send_template":
      return <SendTemplateForm data={data} onChange={onChange} />;
    case "collect_email":
      return <CollectEmailForm data={data} onChange={onChange} />;
    case "ai_reply":
      return (
        <>
          <Field label="Extra instructions" hint="Added to your AI assistant's brand voice and knowledge base for this step only.">
            <Textarea rows={4} value={String(data.instructions ?? "")} placeholder="e.g. They are asking about our Black Friday offer." onChange={(event) => onChange({ instructions: event.target.value })} />
          </Field>
          <PolicyHint>If the AI is not confident enough, or the person asks for a human, the flow follows the <b>Handover</b> branch instead of sending.</PolicyHint>
        </>
      );
    case "condition":
      return <ConditionForm data={data} onChange={onChange} />;
    case "split":
      return (
        <Field label={`Variant A: ${Number(data.percent_a ?? 50)}%`} hint="Each contact is randomly assigned to A or B. Compare results in run history.">
          <input type="range" min={0} max={100} step={5} value={Number(data.percent_a ?? 50)} onChange={(event) => onChange({ percent_a: Number(event.target.value) })} className="w-full accent-[var(--brand)]" />
          <div className="flex justify-between text-[0.7rem] text-muted-foreground">
            <span>A · {Number(data.percent_a ?? 50)}%</span>
            <span>B · {100 - Number(data.percent_a ?? 50)}%</span>
          </div>
        </Field>
      );
    case "delay":
      return (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Wait">
              <Input type="number" min={1} value={Number(data.amount ?? 1)} onChange={(event) => onChange({ amount: Math.max(1, Number(event.target.value)) })} />
            </Field>
            <Field label="Unit">
              <NativeSelect value={String(data.unit ?? "minutes")} onChange={(event) => onChange({ unit: event.target.value })}>
                {["seconds", "minutes", "hours", "days"].map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <PolicyHint tone="warning">Messages after a long delay may fall outside the 24-hour messaging window and will then be blocked automatically.</PolicyHint>
        </>
      );
    case "add_tag":
    case "remove_tag":
      return <TagForm data={data} onChange={onChange} />;
    case "set_field":
      return (
        <>
          <Field label="Field key" hint="Lowercase letters, numbers and underscores.">
            <Input value={String(data.key ?? "")} placeholder="interest" onChange={(event) => onChange({ key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
          </Field>
          <Field label="Value" hint={<>Use <code className="font-mono">{"{{last_input}}"}</code> to store the person&apos;s last reply.</>}>
            <Input value={String(data.value ?? "")} onChange={(event) => onChange({ value: event.target.value })} />
          </Field>
        </>
      );
    case "send_email":
      return <SendEmailForm data={data} onChange={onChange} />;
    case "handover":
      return (
        <>
          <Field label="Note for your team">
            <Textarea rows={3} value={String(data.note ?? "")} placeholder="e.g. Wants a custom quote" onChange={(event) => onChange({ note: event.target.value })} />
          </Field>
          <PolicyHint>The conversation is flagged in the Inbox and AI replies are paused. Your team can reply within 7 days using the Human Agent tag (Instagram & Messenger).</PolicyHint>
        </>
      );
    case "end":
      return <p className="text-sm text-muted-foreground">The automation stops here. Anything connected after this step will not run.</p>;
  }
}

function TriggerForm({ type, config, onChange, readOnly }: { type: TriggerType; config: TriggerConfig; onChange: (type: TriggerType, config: TriggerConfig) => void; readOnly: boolean }) {
  const set = (patch: Partial<TriggerConfig>) => onChange(type, { ...config, ...patch });
  const usesKeywords = type === "comment_keyword" || type === "dm_keyword" || type === "postback";
  const option = TRIGGER_OPTIONS.find((item) => item.value === type);

  return (
    <>
      <Field label="When this happens" hint={option?.hint}>
        <NativeSelect value={type} onChange={(event) => onChange(event.target.value as TriggerType, config)}>
          {TRIGGER_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </NativeSelect>
      </Field>

      {usesKeywords && (
        <>
          <Field label="Match">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {(["contains", "exact", "any"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set({ match: mode })}
                  className={cn("rounded-md py-1 text-xs font-medium capitalize transition-colors", (config.match ?? "contains") === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {mode === "any" ? (type === "comment_keyword" ? "Any comment" : "Anything") : mode}
                </button>
              ))}
            </div>
          </Field>
          {config.match !== "any" && (
            <Field label="Keywords" hint="Press Enter to add. Matching ignores case and emoji, and only matches whole words (LINK won't match “linkedin”).">
              <ChipsInput value={config.keywords ?? []} onChange={(keywords) => set({ keywords })} placeholder="LINK, GUIDE, bei…" disabled={readOnly} />
            </Field>
          )}
          <Field label="Exclude if the message contains" hint="Optional. Useful for skipping complaints, e.g. “broken”.">
            <ChipsInput value={config.exclude_keywords ?? []} onChange={(exclude_keywords) => set({ exclude_keywords })} placeholder="Add a word" disabled={readOnly} />
          </Field>
        </>
      )}

      {type === "comment_keyword" && (
        <>
          <PostPicker selected={config.post_ids ?? []} onChange={(post_ids) => set({ post_ids })} />
          <SwitchRow label="Ignore replies to comments" hint="Only trigger on top-level comments." checked={config.skip_replies ?? true} onChange={(skip_replies) => set({ skip_replies })} disabled={readOnly} />
          <PolicyHint>Instagram and Facebook allow one private reply per comment, within 7 days. Further DMs need the person to reply first.</PolicyHint>
        </>
      )}

      <SwitchRow label="Run once per contact" hint="Skip people who already went through this automation." checked={config.once_per_contact ?? false} onChange={(once_per_contact) => set({ once_per_contact })} disabled={readOnly} />
    </>
  );
}

function PostPicker({ selected, onChange }: { selected: number[]; onChange: (ids: number[]) => void }) {
  const { data: channels } = useSWR<{ data: Channel[] }>("channels");
  const commentChannels = (channels?.data ?? []).filter((channel) => channel.capabilities.comment_reply && channel.status === "connected");
  const [channelId, setChannelId] = useState<number | null>(null);
  const activeId = channelId ?? commentChannels[0]?.id ?? null;
  const { data: posts } = useSWR<{ data: Post[] }>(activeId ? `channels/${activeId}/posts` : null);
  const specific = selected.length > 0;

  return (
    <Field label="Posts & Reels">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <button type="button" onClick={() => onChange([])} className={cn("rounded-md py-1 text-xs font-medium", !specific ? "bg-card shadow-sm" : "text-muted-foreground")}>All posts</button>
        <button
          type="button"
          onClick={() => !specific && posts?.data[0] && onChange([posts.data[0].id])}
          className={cn("rounded-md py-1 text-xs font-medium", specific ? "bg-card shadow-sm" : "text-muted-foreground")}
        >
          Specific posts
        </button>
      </div>
      {specific && (
        <div className="space-y-2 pt-1">
          {commentChannels.length > 1 && (
            <NativeSelect value={activeId ?? ""} onChange={(event) => setChannelId(Number(event.target.value))}>
              {commentChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.name}{channel.is_simulated ? " (simulated)" : ""}</option>
              ))}
            </NativeSelect>
          )}
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1 scrollbar-thin">
            {(posts?.data ?? []).map((post) => {
              const checked = selected.includes(post.id);
              return (
                <label key={post.id} className={cn("flex cursor-pointer items-start gap-2 rounded-md p-2 text-xs hover:bg-muted", checked && "bg-brand-soft/60")}>
                  <input type="checkbox" className="mt-0.5 accent-[var(--brand)]" checked={checked} onChange={() => onChange(checked ? selected.filter((id) => id !== post.id) : [...selected, post.id])} />
                  <span className="min-w-0">
                    <span className="mr-1 rounded bg-muted px-1 text-[0.6rem] font-semibold uppercase">{post.media_type}</span>
                    <span className="line-clamp-2 text-muted-foreground">{post.caption || post.external_id}</span>
                  </span>
                </label>
              );
            })}
            {posts?.data.length === 0 && <p className="p-2 text-xs text-muted-foreground">No posts synced for this channel yet.</p>}
          </div>
        </div>
      )}
    </Field>
  );
}

function ReplyCommentForm({ data, onChange }: { data: Data; onChange: (patch: Data) => void }) {
  const replies = (data.replies as string[]) ?? [""];
  const update = (next: string[]) => onChange({ replies: next });

  return (
    <>
      <Field label="Reply variants" hint="One is picked at random for each comment so your replies look natural.">
        <div className="space-y-2">
          {replies.map((reply, index) => (
            <div key={index} className="flex gap-1.5">
              <Input value={reply} onChange={(event) => update(replies.map((item, position) => (position === index ? event.target.value : item)))} placeholder="Check your DMs! 📩" />
              {replies.length > 1 && (
                <Button variant="ghost" size="icon" type="button" onClick={() => update(replies.filter((_, position) => position !== index))} aria-label="Remove variant">
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
          {replies.length < 5 && (
            <Button variant="outline" size="sm" type="button" onClick={() => update([...replies, ""])}>
              <Plus className="size-3.5" /> Add variant
            </Button>
          )}
        </div>
      </Field>
      <VariableHints onInsert={(variable) => update(replies.map((item, index) => (index === replies.length - 1 ? `${item}${variable}` : item)))} />
    </>
  );
}

function SendMessageForm({ data, onChange }: { data: Data; onChange: (patch: Data) => void }) {
  const buttons = (data.buttons as { title: string; url: string }[]) ?? [];
  const setButtons = (next: { title: string; url: string }[]) => onChange({ buttons: next });

  return (
    <>
      <Field label="Message">
        <Textarea rows={5} value={String(data.text ?? "")} onChange={(event) => onChange({ text: event.target.value })} placeholder="Hey {{first_name}}! Here's the link 👇" />
      </Field>
      <VariableHints onInsert={(variable) => onChange({ text: `${String(data.text ?? "")}${variable}` })} />

      <Field label="Link buttons" hint="Up to 3. Shown as tappable buttons on Instagram & Messenger; added as links elsewhere.">
        <div className="space-y-2">
          {buttons.map((button, index) => (
            <div key={index} className="space-y-1.5 rounded-lg border p-2">
              <div className="flex gap-1.5">
                <Input value={button.title} maxLength={20} placeholder="Button label" onChange={(event) => setButtons(buttons.map((item, position) => (position === index ? { ...item, title: event.target.value } : item)))} />
                <Button variant="ghost" size="icon" type="button" onClick={() => setButtons(buttons.filter((_, position) => position !== index))} aria-label="Remove button">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <Input value={button.url} type="url" placeholder="https://…" onChange={(event) => setButtons(buttons.map((item, position) => (position === index ? { ...item, url: event.target.value } : item)))} />
            </div>
          ))}
          {buttons.length < 3 && (
            <Button variant="outline" size="sm" type="button" onClick={() => setButtons([...buttons, { title: "", url: "" }])}>
              <Plus className="size-3.5" /> Add button
            </Button>
          )}
        </div>
      </Field>

      <SwitchRow label="Wait for a reply" hint="Pause until the person replies — their reply opens a 24-hour messaging window." checked={Boolean(data.wait_for_reply)} onChange={(wait_for_reply) => onChange({ wait_for_reply })} />
      {Boolean(data.wait_for_reply) && (
        <Field label="Give up after (hours)" hint="Follows the “No reply” branch after this time.">
          <Input type="number" min={1} max={168} value={Number(data.timeout_hours ?? 23)} onChange={(event) => onChange({ timeout_hours: Number(event.target.value) })} />
        </Field>
      )}
      <PolicyHint>From a comment, the first DM goes as the single private reply; later messages need the person to reply first. Outside the 24-hour window, sends are blocked automatically.</PolicyHint>
    </>
  );
}

function SendTemplateForm({ data, onChange }: { data: Data; onChange: (patch: Data) => void }) {
  const parameters = (data.parameters as string[]) ?? [];

  return (
    <>
      <Field label="Template name" hint="Exactly as approved in WhatsApp Manager.">
        <Input value={String(data.template ?? "")} placeholder="order_update" onChange={(event) => onChange({ template: event.target.value })} />
      </Field>
      <Field label="Language code">
        <Input value={String(data.language ?? "en")} placeholder="en" onChange={(event) => onChange({ language: event.target.value })} />
      </Field>
      <Field label="Body parameters" hint="Fill {{1}}, {{2}}… in order. Variables like {{first_name}} work here.">
        <div className="space-y-2">
          {parameters.map((value, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">{`{{${index + 1}}}`}</span>
              <Input value={value} onChange={(event) => onChange({ parameters: parameters.map((item, position) => (position === index ? event.target.value : item)) })} />
              <Button variant="ghost" size="icon" type="button" onClick={() => onChange({ parameters: parameters.filter((_, position) => position !== index) })} aria-label="Remove parameter">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" type="button" onClick={() => onChange({ parameters: [...parameters, ""] })}>
            <Plus className="size-3.5" /> Add parameter
          </Button>
        </div>
      </Field>
      <PolicyHint>WhatsApp only allows free-form messages within 24 hours of the customer&apos;s last message. Outside that window, use an approved template like this one.</PolicyHint>
    </>
  );
}

function CollectEmailForm({ data, onChange }: { data: Data; onChange: (patch: Data) => void }) {
  return (
    <>
      <Field label="Question">
        <Textarea rows={4} value={String(data.prompt ?? "")} onChange={(event) => onChange({ prompt: event.target.value })} />
      </Field>
      <Field label="If the reply isn't an email">
        <Textarea rows={2} value={String(data.retry_prompt ?? "")} onChange={(event) => onChange({ retry_prompt: event.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Attempts">
          <Input type="number" min={1} max={5} value={Number(data.max_attempts ?? 2)} onChange={(event) => onChange({ max_attempts: Number(event.target.value) })} />
        </Field>
        <Field label="Timeout (hours)">
          <Input type="number" min={1} max={168} value={Number(data.timeout_hours ?? 23)} onChange={(event) => onChange({ timeout_hours: Number(event.target.value) })} />
        </Field>
      </div>
      <SwitchRow label="Also record marketing consent" hint="Only if your question clearly asks permission to send marketing emails." checked={Boolean(data.marketing_opt_in)} onChange={(marketing_opt_in) => onChange({ marketing_opt_in })} />
      <PolicyHint tone={data.marketing_opt_in ? "warning" : "info"}>
        Your question must state what the email will be used for. The exact wording is stored as consent evidence on the contact. Every email includes an unsubscribe link.
      </PolicyHint>
    </>
  );
}

function ConditionForm({ data, onChange }: { data: Data; onChange: (patch: Data) => void }) {
  type Rule = { field: string; operator: string; value?: string; key?: string };
  const rules = (data.rules as Rule[]) ?? [];
  const setRules = (next: Rule[]) => onChange({ rules: next });
  const operators = (field: string) =>
    field === "tag" ? ["has", "not_has"] : ["exists", "not_exists", "equals", "not_equals", "contains"];

  return (
    <>
      <Field label="Continue on “Yes” when">
        <NativeSelect value={String(data.match ?? "all")} onChange={(event) => onChange({ match: event.target.value })}>
          <option value="all">All rules match</option>
          <option value="any">Any rule matches</option>
        </NativeSelect>
      </Field>
      <div className="space-y-2">
        {rules.map((rule, index) => {
          const update = (patch: Partial<Rule>) => setRules(rules.map((item, position) => (position === index ? { ...item, ...patch } : item)));
          const needsValue = !["exists", "not_exists"].includes(rule.operator);
          return (
            <div key={index} className="space-y-1.5 rounded-lg border bg-background/50 p-2">
              <div className="flex gap-1.5">
                <NativeSelect value={rule.field} onChange={(event) => update({ field: event.target.value, operator: operators(event.target.value)[0] })}>
                  <option value="tag">Tag</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="custom_field">Custom field</option>
                  <option value="text">Last message</option>
                  <option value="platform">Platform</option>
                </NativeSelect>
                <Button variant="ghost" size="icon" type="button" onClick={() => setRules(rules.filter((_, position) => position !== index))} aria-label="Remove rule">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              {rule.field === "custom_field" && <Input value={rule.key ?? ""} placeholder="Field key" onChange={(event) => update({ key: event.target.value })} />}
              <NativeSelect value={rule.operator} onChange={(event) => update({ operator: event.target.value })}>
                {operators(rule.field).map((operator) => (
                  <option key={operator} value={operator}>{operator.replace("_", " ")}</option>
                ))}
              </NativeSelect>
              {(needsValue || rule.field === "tag") && <Input value={rule.value ?? ""} placeholder={rule.field === "tag" ? "Tag name" : "Value"} onChange={(event) => update({ value: event.target.value })} />}
            </div>
          );
        })}
        <Button variant="outline" size="sm" type="button" onClick={() => setRules([...rules, { field: "tag", operator: "has", value: "" }])}>
          <Plus className="size-3.5" /> Add rule
        </Button>
      </div>
    </>
  );
}

function TagForm({ data, onChange }: { data: Data; onChange: (patch: Data) => void }) {
  const { data: tags } = useSWR<{ data: Tag[] }>("tags");

  return (
    <Field label="Tag" hint="New tags are created automatically.">
      <Input list="automation-tags" value={String(data.tag ?? "")} placeholder="vip-lead" onChange={(event) => onChange({ tag: event.target.value })} />
      <datalist id="automation-tags">
        {tags?.data.map((tag) => <option key={tag.id} value={tag.name} />)}
      </datalist>
    </Field>
  );
}

function SendEmailForm({ data, onChange }: { data: Data; onChange: (patch: Data) => void }) {
  const { data: email } = useSWR<{ templates: { id: number; name: string; subject: string; category: string }[] }>("email");

  return (
    <>
      <Field label="Email template">
        <NativeSelect
          value={data.template_id ? String(data.template_id) : ""}
          onChange={(event) => {
            const template = email?.templates.find((item) => String(item.id) === event.target.value);
            onChange({ template_id: template ? template.id : null, template_name: template?.name ?? null });
          }}
        >
          <option value="">Select a template…</option>
          {email?.templates.map((template) => (
            <option key={template.id} value={template.id}>{template.name} ({template.category})</option>
          ))}
        </NativeSelect>
      </Field>
      {email?.templates.length === 0 && <p className="text-xs text-muted-foreground">Create a template in Email first.</p>}
      <PolicyHint>Sent only if the contact has an email and matching consent — marketing templates need marketing consent. Otherwise this step is skipped and logged.</PolicyHint>
    </>
  );
}
