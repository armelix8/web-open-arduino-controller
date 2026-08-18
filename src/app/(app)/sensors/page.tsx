"use client";

import { SensorDashboard } from "@/components/sensors/dashboard";
import { Button } from "@/components/ui/button";
import { useConnectionStore } from "@/lib/store/connection";
import { toast } from "sonner";

export default function SensorsPage() {
  const send = useConnectionStore((s) => s.send);
  const status = useConnectionStore((s) => s.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-400/80">
            Telemetry
          </p>
          <h1 className="page-title mt-2 text-3xl text-white md:text-4xl">
            Sensors
          </h1>
          <p className="mt-2 text-slate-400">
            Live gauges, progress bars, and real-time charts.
          </p>
        </div>
        <div className="flex gap-2">
          {["TEMP?", "STATUS?", "DIST?"].map((cmd) => (
            <Button
              key={cmd}
              size="sm"
              variant="secondary"
              disabled={status !== "connected"}
              onClick={async () => {
                try {
                  await send(cmd);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              {cmd}
            </Button>
          ))}
        </div>
      </div>
      <SensorDashboard />
    </div>
  );
}
