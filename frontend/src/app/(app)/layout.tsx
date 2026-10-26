import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Logo } from "@/components/app/logo";

/**
 * The dashboard is fully client-rendered per user; the Suspense boundary lets
 * Cache Components prerender a lightweight shell while hooks resolve at runtime.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] border-r bg-sidebar p-5 lg:block">
        <Logo />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-7 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </aside>
      <div className="flex-1 lg:pl-[248px]">
        <div className="h-14 border-b" />
      </div>
    </div>
  );
}
