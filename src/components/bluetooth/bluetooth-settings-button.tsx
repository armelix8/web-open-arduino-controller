"use client";

import { toast } from "sonner";
import { Bluetooth } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/lib/use-mounted";
import { bluetoothSettingsFor, detectOS } from "@/lib/os";
import { cn } from "@/lib/utils";

/**
 * Shortcut that opens the OS Bluetooth settings so the user can pair a Classic
 * module first (the browser can't pair or scan Classic BT itself). Detects the
 * OS and only renders a working button where a scheme exists (Windows, Android);
 * elsewhere it shows a short manual hint.
 */
export function BluetoothSettingsButton({ className }: { className?: string }) {
  const mounted = useMounted();
  // OS detection is client-only — render nothing until mounted to keep SSR and
  // the first client render identical (no hydration mismatch).
  if (!mounted) return null;

  const os = detectOS();
  const target = bluetoothSettingsFor(os);

  if (!target) {
    return (
      <p className={cn("text-xs text-slate-500", className)}>
        Open your device&apos;s Bluetooth settings to pair the module, then come
        back and reconnect.
      </p>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className={className}
      onClick={() => {
        try {
          window.location.href = target.url;
        } catch {
          toast.message("Open your OS Bluetooth settings manually to pair.");
        }
      }}
    >
      <Bluetooth size={14} />
      {target.label}
    </Button>
  );
}
