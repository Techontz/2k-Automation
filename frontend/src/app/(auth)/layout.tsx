import { Logo } from "@/components/app/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px] animate-in-up">{children}</div>
        </div>
        <p className="text-xs text-muted-foreground">Built on official Meta & TikTok APIs. Your accounts stay safe.</p>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-card lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--brand-soft),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <div className="max-w-md">
            <p className="text-sm font-medium text-brand">Comment → DM, on autopilot</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">Turn every comment into a conversation.</h2>
            <p className="mt-3 text-muted-foreground">Reply to keywords on Reels, send links in private replies, capture leads and hand off to your team — all within each platform&apos;s rules.</p>
          </div>
          <div className="mt-10 max-w-md space-y-3">
            {[
              { who: "@amina.k", text: "CLAUDE 🔥", side: "left" },
              { who: "You", text: "Check your DMs Amina! 📩", side: "right" },
              { who: "You · private reply", text: "Here's the Claude guide 👇  Open the guide", side: "right" },
            ].map((bubble, index) => (
              <div key={index} className={bubble.side === "right" ? "flex justify-end" : "flex"} style={{ animationDelay: `${index * 120}ms` }}>
                <div className={`animate-in-up rounded-2xl px-4 py-2.5 text-sm shadow-sm ${bubble.side === "right" ? "bg-brand text-white" : "border bg-background"}`}>
                  <div className={`text-[0.65rem] font-medium ${bubble.side === "right" ? "text-white/70" : "text-muted-foreground"}`}>{bubble.who}</div>
                  {bubble.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
