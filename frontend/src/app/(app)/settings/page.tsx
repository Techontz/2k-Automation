"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/page-header";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { ProfileTab } from "@/components/settings/profile-tab";
import { SecurityTab } from "@/components/settings/security-tab";
import { TeamTab } from "@/components/settings/team-tab";
import { WorkspaceTab } from "@/components/settings/workspace-tab";
import { useCan } from "@/hooks/use-session";

const TABS = [
  { value: "workspace", label: "Workspace" },
  { value: "profile", label: "Profile" },
  { value: "team", label: "Team" },
  { value: "integrations", label: "Integrations" },
  { value: "security", label: "Security & audit" },
];

function SettingsTabs() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const canManageSettings = useCan("settings.manage");
  const canManageTeam = useCan("team.manage");
  const tab = TABS.some((item) => item.value === params.get("tab")) ? (params.get("tab") as string) : "workspace";

  return (
    <Tabs value={tab} onValueChange={(value) => router.replace(`${pathname}?tab=${value}`, { scroll: false })}>
      <TabsList className="mb-4 w-full justify-start overflow-x-auto sm:w-fit">
        {TABS.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="workspace">
        <WorkspaceTab canManage={canManageSettings} />
      </TabsContent>
      <TabsContent value="profile">
        <ProfileTab />
      </TabsContent>
      <TabsContent value="team">
        <TeamTab canManage={canManageTeam} />
      </TabsContent>
      <TabsContent value="integrations">
        <IntegrationsTab />
      </TabsContent>
      <TabsContent value="security">
        <SecurityTab canView={canManageSettings} />
      </TabsContent>
    </Tabs>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Workspace preferences, your profile, team access, integrations and security." />
      <Suspense>
        <SettingsTabs />
      </Suspense>
    </>
  );
}
