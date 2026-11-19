"use client";

import { ControllerDashboard } from "@/components/controller/dashboard";
import { CustomCommands } from "@/components/controller/custom-commands";
import { SerialTerminal } from "@/components/bluetooth/serial-terminal";
import { useUiMode } from "@/lib/store/ui-mode";

export default function ControllerPage() {
  const mode = useUiMode((s) => s.mode);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400/80">
          Control Surface
        </p>
        <h1 className="page-title mt-2 text-3xl text-white md:text-4xl">
          Controller
        </h1>
        <p className="mt-2 text-slate-400">
          Grouped controls for lights, motors, outputs, and inputs. Tap ⓘ for a
          quick explanation of any control.
        </p>
      </div>

      <ControllerDashboard />

      {mode === "advanced" && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
            <span aria-hidden>🛠️</span>
            Advanced / Custom
          </h2>
          <CustomCommands />
        </section>
      )}

      <SerialTerminal />
    </div>
  );
}
