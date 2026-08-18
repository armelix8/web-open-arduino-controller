"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { useEffect } from "react";
import { useConnectionStore } from "@/lib/store/connection";

export function Providers({ children }: { children: React.ReactNode }) {
  const tickDuration = useConnectionStore((s) => s.tickDuration);

  useEffect(() => {
    const id = setInterval(tickDuration, 1000);
    return () => clearInterval(id);
  }, [tickDuration]);

  return (
    <ThemeProvider>
      {children}
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          classNames: {
            toast:
              "bg-slate-900/95 border border-white/10 text-white backdrop-blur",
          },
        }}
      />
    </ThemeProvider>
  );
}
