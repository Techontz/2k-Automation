import { PlatformIcon } from "@/components/app/platform-icon";
import { initials } from "@/lib/format";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Initials avatar with a small platform badge in the corner. */
export function ContactAvatar({ name, platform, className }: { name: string; platform?: Platform; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-9 shrink-0", className)}>
      <span className="flex size-full items-center justify-center rounded-full bg-brand-soft text-[0.72rem] font-semibold text-brand">
        {initials(name) || "?"}
      </span>
      {platform && <PlatformIcon platform={platform} className="absolute -right-1 -bottom-1 size-4 rounded-[5px] ring-2 ring-card" />}
    </span>
  );
}
