"use client";

import { useMemo, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, NativeSelect } from "@/components/settings/form-kit";
import { api, ApiError } from "@/lib/api";
import type { EmailTemplate } from "./types";

const STARTER_HTML = `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #16161d;">
  <h1 style="font-size: 22px;">Hi {{first_name}} 👋</h1>
  <p>Thanks for your interest! Here is the guide you asked for.</p>
  <p>
    <a href="https://example.com/guide" style="display: inline-block; background: #5B3DF5; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none;">Download the guide</a>
  </p>
  <p style="color: #6b6b7b;">— The team</p>
</div>`;

const VARIABLES = ["{{first_name}}", "{{name}}", "{{username}}", "{{email}}", "{{custom.field}}"];

const SAMPLE: Record<string, string> = { first_name: "Amina", name: "Amina Kweka", username: "amina.k", email: "amina@example.com" };

/** Renders variables with sample data so the preview reads like a real email. */
function previewHtml(html: string): string {
  const rendered = html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => (key.startsWith("custom.") ? `[${key.slice(7)}]` : SAMPLE[key] ?? ""));
  return `${rendered}<p style="margin-top:32px;font-size:12px;color:#888;font-family:Arial,sans-serif">You received this email because you shared your address with us. <a href="#">Unsubscribe</a></p>`;
}

export function TemplateEditor(props: React.ComponentProps<typeof TemplateEditorBody> & { open: boolean }) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <TemplateEditorBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

interface BodyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: number | null;
  onSaved: () => void;
}

/** Loads the template being edited, then mounts the form with it as initial state. */
function TemplateEditorBody(props: BodyProps) {
  const { data: template, error } = useSWR<EmailTemplate>(props.templateId !== null ? `email/templates/${props.templateId}` : null);

  if (props.templateId !== null && !template) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
        {error ? error.message : <Loader2 className="size-5 animate-spin" />}
      </div>
    );
  }

  return (
    <TemplateForm
      {...props}
      initial={
        template
          ? { name: template.name, subject: template.subject, category: template.category, body_html: template.body_html ?? "" }
          : { name: "", subject: "", category: "transactional", body_html: STARTER_HTML }
      }
    />
  );
}

function TemplateForm({
  onOpenChange,
  templateId,
  onSaved,
  initial,
}: BodyProps & { initial: { name: string; subject: string; category: EmailTemplate["category"]; body_html: string } }) {
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const srcDoc = useMemo(() => previewHtml(form.body_html), [form.body_html]);

  async function save() {
    setPending(true);
    setErrors({});
    try {
      if (templateId === null) {
        await api.post("email/templates", form);
      } else {
        await api.patch(`email/templates/${templateId}`, form);
      }
      toast.success("Template saved");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.errors);
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>{templateId === null ? "New email template" : "Edit template"}</DialogTitle>
          <DialogDescription>Write HTML once and reuse it in automations and campaigns.</DialogDescription>
        </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <FormField label="Template name" htmlFor="tpl-name" error={errors.name?.[0]}>
                <Input id="tpl-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Claude guide delivery" />
              </FormField>
              <FormField label="Subject line" htmlFor="tpl-subject" error={errors.subject?.[0]}>
                <Input id="tpl-subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Your free guide, {{first_name}}" />
              </FormField>
              <FormField
                label="Category"
                htmlFor="tpl-category"
                hint={
                  form.category === "marketing"
                    ? "Marketing emails only reach contacts with recorded marketing consent."
                    : "Transactional emails deliver something the contact asked for (e.g. a lead magnet)."
                }
              >
                <NativeSelect id="tpl-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as EmailTemplate["category"] })}>
                  <option value="transactional">Transactional — requested content</option>
                  <option value="marketing">Marketing — newsletters & promotions</option>
                </NativeSelect>
              </FormField>
              <FormField label="HTML body" htmlFor="tpl-body" error={errors.body_html?.[0]}>
                <Textarea
                  id="tpl-body"
                  value={form.body_html}
                  onChange={(event) => setForm({ ...form, body_html: event.target.value })}
                  className="min-h-64 font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
              </FormField>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Insert variable</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => setForm({ ...form, body_html: `${form.body_html}${variable}` })}
                      className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-[0.7rem] transition-colors hover:border-brand/40 hover:text-brand"
                    >
                      {variable}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium">Preview</span>
                <span className="text-xs text-muted-foreground">Sample contact: Amina</span>
              </div>
              <div className="flex-1 overflow-hidden rounded-xl border bg-white">
                <div className="border-b bg-neutral-50 px-4 py-2.5 text-xs text-neutral-600">
                  <span className="font-medium text-neutral-900">Subject:</span> {form.subject.replace(/\{\{\s*first_name\s*\}\}/g, "Amina") || "—"}
                </div>
                <iframe title="Email preview" sandbox="" srcDoc={srcDoc} className="h-[420px] w-full bg-white" />
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                An unsubscribe link is added to every email automatically. Clicking it revokes the contact&apos;s email consent.
              </p>
            </div>
          </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save template
          </Button>
        </DialogFooter>
    </>
  );
}
