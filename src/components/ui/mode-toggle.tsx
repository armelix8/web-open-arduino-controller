"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useUiMode, type UiMode } from "@/lib/store/ui-mode";

const OPTIONS: Array<{ value: UiMode; label: string; emoji: string }> = [
  { value: "beginner", label: "Beginner", emoji: "🧒" },
  { value: "advanced", label: "Advanced", emoji: "🛠️" },
];

/** App-wide Beginner / Advanced switch. Placed in the sidebar so it affects every page. */
export function ModeToggle({ className }: { className?: string }) {
  const mode = useUiMode((s) => s.mode);
  const setMode = useUiMode((s) => s.setMode);
  const init = useUiMode((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div
      role="group"
      aria-label="Interface complexity"
      className={cn(
        "grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/20 p-1",
        className
      )}
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => setMode(opt.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-cyan-500/20 text-white ring-1 ring-cyan-400/40"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <span aria-hidden>{opt.emoji}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
