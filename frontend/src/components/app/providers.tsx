"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { SWRConfig } from "swr";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fetcher } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <SWRConfig value={{ fetcher, revalidateOnFocus: false, shouldRetryOnError: false }}>
        <TooltipProvider delay={250}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </SWRConfig>
    </ThemeProvider>
  );
}
