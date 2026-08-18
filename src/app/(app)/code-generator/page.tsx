"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { generateArduinoSketch } from "@/lib/arduino-generator";
import { downloadText } from "@/lib/utils";

const modules = ["hc05", "hc06", "hm10", "esp32"] as const;
const componentOptions = [
  "led",
  "servo",
  "relay",
  "motor",
  "dht",
  "ultrasonic",
  "rgb",
] as const;

export default function CodeGeneratorPage() {
  const [module, setModule] =
    useState<(typeof modules)[number]>("hm10");
  const [components, setComponents] = useState<string[]>(["led", "dht"]);
  const sketch = generateArduinoSketch({
    module,
    components: components as Array<(typeof componentOptions)[number]>,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400/80">
          Firmware
        </p>
        <h1 className="page-title mt-2 text-3xl text-white md:text-4xl">
          Arduino Code Generator
        </h1>
        <p className="mt-2 text-slate-400">
          Select module + components and generate a compatible sketch.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Module</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {modules.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={module === m ? "default" : "secondary"}
                onClick={() => setModule(m)}
              >
                {m.toUpperCase()}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Components</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {componentOptions.map((c) => (
              <label
                key={c}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm capitalize"
              >
                {c}
                <Switch
                  checked={components.includes(c)}
                  onCheckedChange={(v) =>
                    setComponents((prev) =>
                      v ? [...prev, c] : prev.filter((x) => x !== c)
                    )
                  }
                />
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Generated Sketch</CardTitle>
          <Button
            onClick={() => {
              downloadText(sketch, `${module}_bt_arduino.ino`);
              toast.success("Sketch downloaded");
            }}
          >
            Download .ino
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[480px] overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-emerald-200">
            {sketch}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
