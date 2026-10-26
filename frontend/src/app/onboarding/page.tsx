"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, FlaskConical, Loader2, Plug, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app/logo";
import { PlatformIcon } from "@/components/app/platform-icon";
import { api } from "@/lib/api";
import type { Automation } from "@/lib/types";
import { cn } from "@/lib/utils";

const GOALS = [
  { key: "comment_to_dm", title: "Send links from Reel comments", text: "Comment a keyword → public reply + private DM with your link." },
  { key: "lead_magnet", title: "Grow my email list", text: "Collect emails with consent and deliver a lead magnet." },
  { key: "story_reply_ai", title: "Answer DMs with AI", text: "English & Swahili replies from your knowledge base, with human handover." },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("comment_to_dm");
  const [pending, setPending] = useState(false);

  async function finish(destination: "simulator" | "channels") {
    setPending(true);
    try {
      const automation = await api.post<{ data: Automation }>("automations", { template: goal });
      await api.patch("workspace", { onboarded: true, settings: { goal } });
      router.push(destination === "simulator" ? `/simulator?automation=${automation.data.id}` : "/channels");
    } catch (error) {
      toast.error((error as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between px-6 sm:px-10">
        <Logo />
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Skip for now</Link>
      </header>
      <div className="flex flex-1 items-start justify-center px-6 pb-16 pt-6 sm:pt-12">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex items-center gap-2">
            {["Your goal", "Get started"].map((label, index) => (
              <div key={label} className="flex items-center gap-2">
                <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", index <= step ? "bg-brand text-white" : "bg-muted text-muted-foreground")}>
                  {index < step ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className={cn("text-sm", index === step ? "font-medium" : "text-muted-foreground")}>{label}</span>
                {index === 0 && <span className="mx-2 h-px w-10 bg-border" />}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="animate-in-up">
              <h1 className="text-2xl font-semibold tracking-tight">What do you want to automate first?</h1>
              <p className="mt-1.5 text-muted-foreground">We will set up a ready-made automation you can customise.</p>
              <div className="mt-8 grid gap-3">
                {GOALS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setGoal(item.key)}
                    className={cn(
                      "flex items-start gap-4 rounded-xl border bg-card p-4 text-left transition-all hover:border-brand/40",
                      goal === item.key && "border-brand ring-3 ring-brand/15",
                    )}
                  >
                    <span className={cn("mt-0.5 flex size-5 items-center justify-center rounded-full border", goal === item.key && "border-brand bg-brand text-white")}>
                      {goal === item.key && <Check className="size-3" />}
                    </span>
                    <span>
                      <span className="block font-medium">{item.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{item.text}</span>
                    </span>
                  </button>
                ))}
              </div>
              <Button className="mt-8 h-10" onClick={() => setStep(1)}>
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="animate-in-up">
              <h1 className="text-2xl font-semibold tracking-tight">Try it safely, then go live</h1>
              <p className="mt-1.5 text-muted-foreground">Test your automation in the simulator before connecting a real account.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <button disabled={pending} onClick={() => finish("simulator")} className="group rounded-xl border-2 border-brand bg-card p-5 text-left transition-shadow hover:shadow-md">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><FlaskConical className="size-5" /></span>
                  <span className="mt-4 flex items-center gap-2 font-semibold">Open the simulator <span className="rounded-full bg-brand px-2 py-0.5 text-[0.65rem] text-white">Recommended</span></span>
                  <span className="mt-1 block text-sm text-muted-foreground">Comment &quot;LINK&quot; on a test Reel and watch every step run. Nothing is sent to Instagram.</span>
                </button>
                <button disabled={pending} onClick={() => finish("channels")} className="rounded-xl border bg-card p-5 text-left transition-shadow hover:shadow-md">
                  <span className="flex gap-1.5">
                    <PlatformIcon platform="instagram" className="size-10 rounded-xl" />
                    <PlatformIcon platform="whatsapp" className="size-10 rounded-xl" />
                  </span>
                  <span className="mt-4 flex items-center gap-2 font-semibold"><Plug className="size-4" /> Connect an account</span>
                  <span className="mt-1 block text-sm text-muted-foreground">Connect Instagram, Messenger or WhatsApp through official OAuth.</span>
                </button>
              </div>
              {pending && <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Setting things up…</p>}
              <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="size-3.5 text-brand" /> You can change your goal and add more automations any time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
