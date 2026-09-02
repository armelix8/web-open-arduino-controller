"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small ⓘ help affordance for unfamiliar terms.
 * Works on desktop (hover title + focus) and touch (tap to toggle a bubble).
 */
export function InfoHint({
  text,
  label,
  className,
}: {
  text: string;
  /** Accessible name, e.g. the term being explained. */
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <span className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        title={text}
        aria-label={label ? `${label}: ${text}` : text}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
      >
        <Info size={14} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-6 z-30 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs font-normal leading-snug text-slate-200 shadow-xl shadow-black/40 backdrop-blur"
        >
          {text}
        </span>
      )}
    </span>
  );
}
