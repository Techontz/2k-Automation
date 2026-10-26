import { Suspense } from "react";
import { ChannelsView } from "@/components/channels/channels-view";

export const metadata = { title: "Channels" };

export default function ChannelsPage() {
  return (
    <Suspense>
      <ChannelsView />
    </Suspense>
  );
}
