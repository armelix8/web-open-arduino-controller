"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plug,
  Gamepad2,
  Activity,
  Zap,
  History,
  Code2,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/lib/store/connection";
import { ModeToggle } from "@/components/ui/mode-toggle";

const nav = [
  { href: "/connect", label: "Connect", icon: Plug },
  { href: "/controller", label: "Controller", icon: Gamepad2 },
  { href: "/sensors", label: "Sensors", icon: Activity },
  { href: "/automation", label: "Automation", icon: Zap },
  { href: "/history", label: "History", icon: History },
  { href: "/code-generator", label: "Code Gen", icon: Code2 },
];

const statusColor: Record<string, string> = {
  disconnected: "bg-slate-500",
  scanning: "bg-amber-400 animate-pulse",
  connecting: "bg-amber-400 animate-pulse",
  connected: "bg-emerald-400",
  reconnecting: "bg-orange-400 animate-pulse",
  error: "bg-rose-500",
};

export function Sidebar() {
  const pathname = usePathname();
  const status = useConnectionStore((s) => s.status);
  const device = useConnectionStore((s) => s.device);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="fixed z-50 rounded-xl border border-white/10 bg-slate-900/80 p-3 text-white backdrop-blur md:hidden"
        style={{
          left: "max(1rem, env(safe-area-inset-left))",
          top: "max(1rem, env(safe-area-inset-top))",
        }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-slate-950/90 backdrop-blur-xl transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="border-b border-white/10 px-5 py-6">
          <Link href="/connect" className="block" onClick={() => setOpen(false)}>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-400/80">
              Industrial PWA
            </div>
            <div className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold text-white">
              Open Arduino
            </div>
            <div className="text-sm text-slate-400">Controller</div>
          </Link>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
            <span className={cn("h-2 w-2 rounded-full", statusColor[status])} />
            <span className="capitalize text-slate-300">{status}</span>
            {device?.name && (
              <span className="truncate text-slate-500">· {device.name}</span>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-cyan-500/15 border border-cyan-400/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon size={18} className="relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 px-1 text-[11px] uppercase tracking-wide text-slate-500">
            Mode
          </div>
          <ModeToggle />
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
