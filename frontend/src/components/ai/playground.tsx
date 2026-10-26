"use client";

import { useRef, useState } from "react";
import { ArrowUp, Bot, Hand, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AiTestResult } from "./types";

interface Turn {
  id: number;
  question: string;
  result?: AiTestResult;
}

const SUGGESTIONS = ["Do you deliver to Arusha?", "Bei ya bidhaa ni kiasi gani?", "I want to speak to a human"];
const LANGUAGES: Record<string, string> = { en: "English", sw: "Swahili", other: "Other" };

/** Ask the assistant test questions; nothing is sent to any customer. */
export function Playground() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    const id = nextId.current++;
    setTurns((current) => [...current, { id, question: text }]);
    setInput("");
    setPending(true);

    try {
      const result = await api.post<AiTestResult>("ai/test", { message: text });
      setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, result } : turn)));
    } catch (error) {
      toast.error((error as Error).message);
      setTurns((current) => current.filter((turn) => turn.id !== id));
    } finally {
      setPending(false);
      requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }));
    }
  }

  return (
    <section className="flex h-[560px] flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold">Test the assistant</h2>
          <p className="text-xs text-muted-foreground">Uses your saved settings. Nothing is sent to customers.</p>
        </div>
        {turns.length > 0 && (
          <Button variant="ghost" size="icon-sm" aria-label="Clear conversation" onClick={() => setTurns([])}>
            <RotateCcw className="size-3.5" />
          </Button>
        )}
      </div>

      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4 scrollbar-thin">
        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Bot className="size-5" />
            </span>
            <p className="text-sm font-medium">Ask something a customer would</p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} onClick={() => ask(suggestion)} className="rounded-full border bg-card px-3 py-1 text-xs transition-colors hover:border-brand/40 hover:text-brand">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="space-y-2 animate-in-up">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-sm text-white">{turn.question}</div>
            </div>
            {!turn.result ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Thinking…
              </div>
            ) : turn.result.handover ? (
              <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-warning/30 bg-warning/5 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <Hand className="size-3.5" /> Handed over to a human
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{turn.result.reason}</p>
                <Meta result={turn.result} />
              </div>
            ) : (
              <div className="max-w-[90%] rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5">
                <p className="whitespace-pre-wrap text-sm">{turn.result.reply}</p>
                <Meta result={turn.result} />
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t p-3"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a customer message…"
          maxLength={1000}
          className="h-9 flex-1 rounded-lg border bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send test message">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </Button>
      </form>
    </section>
  );
}

function Meta({ result }: { result: AiTestResult }) {
  const percent = Math.round(result.confidence * 100);

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-2 text-[0.7rem] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        Confidence
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
          <span className={cn("block h-full rounded-full", percent >= 70 ? "bg-success" : percent >= 40 ? "bg-warning" : "bg-destructive")} style={{ width: `${percent}%` }} />
        </span>
        <span className="tabular-nums">{percent}%</span>
      </span>
      <span>{LANGUAGES[result.language] ?? result.language}</span>
      <span className="capitalize">{result.provider === "built-in" ? "Built-in matcher" : result.provider}</span>
    </div>
  );
}
