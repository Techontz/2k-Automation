import { AlertTriangle, Bot, Check, CheckCheck, Clock, ExternalLink, Workflow, Ban } from "lucide-react";
import { dateTime } from "@/lib/format";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABELS: Partial<Record<Message["kind"], string>> = {
  private_reply: "Private reply",
  comment_reply: "Public comment reply",
  comment: "Comment",
  template: "Template",
};

function SourceLabel({ message }: { message: Message }) {
  if (message.direction === "in") return null;
  const label =
    message.source === "ai" ? (
      <><Bot className="size-3" /> AI assistant</>
    ) : message.source === "automation" ? (
      <><Workflow className="size-3" /> Automation</>
    ) : message.source === "user" ? (
      <>{message.sender?.name ?? "Teammate"}</>
    ) : (
      <>System</>
    );

  return <span className="inline-flex items-center gap-1">{label}</span>;
}

function StatusIcon({ status }: { status: Message["status"] }) {
  switch (status) {
    case "queued":
      return <Clock className="size-3" aria-label="Queued" />;
    case "sent":
      return <Check className="size-3" aria-label="Sent" />;
    case "delivered":
      return <CheckCheck className="size-3" aria-label="Delivered" />;
    case "read":
      return <CheckCheck className="size-3 text-brand" aria-label="Read" />;
    case "failed":
      return <AlertTriangle className="size-3 text-destructive" aria-label="Failed" />;
    case "blocked":
      return <Ban className="size-3 text-warning" aria-label="Blocked by policy" />;
    default:
      return null;
  }
}

export function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "out";
  const problem = message.status === "failed" || message.status === "blocked";
  const kindLabel = KIND_LABELS[message.kind];
  const buttons = message.payload?.buttons ?? [];

  if (message.kind === "note") {
    return (
      <div className="my-2 text-center text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-3 py-1">{message.body}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[82%] flex-col sm:max-w-[70%]", outbound ? "items-end" : "items-start")}>
        {(kindLabel || outbound) && (
          <div className="mb-1 flex items-center gap-1.5 px-1 text-[0.68rem] text-muted-foreground">
            <SourceLabel message={message} />
            {kindLabel && outbound && <span aria-hidden>·</span>}
            {kindLabel && <span className="font-medium">{kindLabel}</span>}
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
            outbound
              ? message.source === "user"
                ? "rounded-br-md bg-foreground text-background"
                : "rounded-br-md bg-brand text-white"
              : "rounded-bl-md border bg-card",
            problem && "opacity-60",
            message.is_simulated && "outline-1 outline-offset-2 outline-dashed outline-warning/50",
          )}
        >
          {message.body || <span className="italic opacity-70">(attachment)</span>}
        </div>
        {buttons.length > 0 && (
          <div className="mt-1 flex w-full flex-col gap-1">
            {buttons.map((button) => (
              <a
                key={button.url}
                href={button.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border bg-card px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-muted"
              >
                {button.title} <ExternalLink className="size-3" />
              </a>
            ))}
          </div>
        )}
        {problem && message.error_message && (
          <p className={cn("mt-1 max-w-full px-1 text-[0.7rem]", message.status === "failed" ? "text-destructive" : "text-warning")}>
            {message.status === "blocked" ? "Not sent — " : "Failed — "}
            {message.error_message}
          </p>
        )}
        <div className="mt-0.5 flex items-center gap-1 px-1 text-[0.65rem] text-muted-foreground" title={dateTime(message.created_at)}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {outbound && <StatusIcon status={message.status} />}
          {message.is_simulated && <span className="font-semibold text-warning">· sim</span>}
        </div>
      </div>
    </div>
  );
}
