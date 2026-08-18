"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/badge";
import { Sparkline } from "@/components/ui/sparkline";
import { useConnectionStore } from "@/lib/store/connection";

const gaugeMax: Record<string, number> = {
  TEMPERATURE: 50,
  HUMIDITY: 100,
  DISTANCE: 400,
  LIGHT: 1000,
  PRESSURE: 1100,
  VOLTAGE: 12,
  CURRENT: 5,
  BATTERY: 100,
  GAS: 1000,
  MOTION: 1,
  WATER_LEVEL: 100,
  RPM: 5000,
};

export function SensorDashboard() {
  const sensors = useConnectionStore((s) => s.sensors);
  const list = Object.values(sensors);

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-400">
          Waiting for sensor data… Send <code className="text-cyan-300">TEMP?</code> or
          enable Arduino telemetry.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((s) => {
          const max = gaugeMax[s.type] || 100;
          const pct = Math.min(100, (s.value / max) * 100);
          return (
            <Card key={s.type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-400">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold text-white">
                  {s.value}
                  <span className="ml-1 text-sm font-normal text-slate-500">
                    {s.unit}
                  </span>
                </div>
                <Progress value={pct} className="mt-3" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {list
          .filter((s) => s.history.length > 1)
          .map((s) => (
            <Card key={`chart-${s.type}`}>
              <CardHeader>
                <CardTitle>
                  {s.label}{" "}
                  <span className="text-slate-500 font-normal text-sm">live</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-40">
                <Sparkline points={s.history.map((h) => h.v)} />
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
