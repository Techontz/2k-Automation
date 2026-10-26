"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import useSWR, { useSWRConfig } from "swr";
import {
  BarChart3,
  Bot,
  Check,
  ChevronsUpDown,
  Contact as ContactIcon,
  FlaskConical,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  Moon,
  Plug,
  Plus,
  Settings,
  Sun,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/app/logo";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { initials } from "@/lib/format";
import type { Overview } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Automate",
    items: [
      { href: "/automations", label: "Automations", icon: Workflow },
      { href: "/comments", label: "Comments", icon: MessageSquareText },
      { href: "/simulator", label: "Simulator", icon: FlaskConical },
    ],
  },
  {
    label: "Engage",
    items: [
      { href: "/inbox", label: "Inbox", icon: Inbox, badge: "inbox" as const },
      { href: "/contacts", label: "Contacts", icon: ContactIcon },
      { href: "/email", label: "Email", icon: Mail },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/ai", label: "AI Assistant", icon: Bot },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/channels", label: "Channels", icon: Plug },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data } = useSWR<Overview>("analytics/overview?days=7&include_simulated=1", { refreshInterval: 30000 });
  const needsHuman = data?.totals.needs_human ?? 0;

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 scrollbar-thin">
      {NAV.map((section) => (
        <div key={section.label}>
          <div className="mb-1 px-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">{section.label}</div>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[0.84rem] font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className={cn("size-4", active ? "text-brand" : "text-muted-foreground group-hover:text-foreground")} />
                    <span className="flex-1">{item.label}</span>
                    {"badge" in item && needsHuman > 0 && (
                      <span className="rounded-full bg-brand px-1.5 text-[0.65rem] font-semibold leading-[1.1rem] text-white">{needsHuman}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function WorkspaceSwitcher() {
  const { user, workspace } = useSession();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  async function switchTo(id: number) {
    await fetch("/api/auth/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: id }) });
    await mutate(() => true, undefined, { revalidate: true });
    router.push("/dashboard");
  }

  async function createWorkspace() {
    const name = window.prompt("Workspace name");
    if (!name) return;
    try {
      const created = await api.post<{ data: { id: number } }>("workspaces", { name });
      await switchTo(created.data.id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left transition-colors hover:bg-muted" />
        }
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-[0.7rem] font-semibold text-background">
          {initials(workspace?.name ?? "W")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8rem] font-semibold">{workspace?.name ?? "Loading…"}</span>
          <span className="block text-[0.7rem] capitalize text-muted-foreground">{workspace?.role ?? ""}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {user?.workspaces?.map((item) => (
            <DropdownMenuItem key={item.id} onClick={() => item.id !== workspace?.id && switchTo(item.id)}>
              <span className="flex-1 truncate">{item.name}</span>
              {item.id === workspace?.id && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={createWorkspace}>
          <Plus className="size-3.5" /> New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await mutate(() => true, undefined, { revalidate: false });
    router.replace("/login");
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun className="size-4 dark:hidden" />
        <Moon className="hidden size-4 dark:block" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<button className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand" />}>
          {initials(user?.name ?? "U")}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="text-sm font-medium text-foreground">{user?.name}</div>
              <div className="truncate text-xs font-normal">{user?.email}</div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/settings" />}>
            <Settings className="size-3.5" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={logout}>
            <LogOut className="size-3.5" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const fullBleed = /^\/automations\/\d+/.test(pathname);

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-5">
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <div className="px-3 pb-4">
        <WorkspaceSwitcher />
      </div>
      <SidebarNav onNavigate={onNavigate} />
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r bg-sidebar lg:block">{sidebar()}</aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[264px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar(() => setMobileOpen(false))}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-4" />
          </Button>
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <div className="flex-1" />
          <UserMenu />
        </header>
        <main className={cn("flex-1", fullBleed ? "" : "mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8")}>{children}</main>
      </div>
    </div>
  );
}
