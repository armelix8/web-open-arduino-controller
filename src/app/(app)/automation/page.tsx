"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useConnectionStore } from "@/lib/store/connection";
import type { AutomationRuleLike } from "@/lib/automation";

type FormValues = {
  name: string;
  sensorType: string;
  operator: string;
  threshold: number;
  actionCommand: string;
  cooldownSec: number;
};

const defaults: FormValues = {
  name: "Fan above 35°C",
  sensorType: "TEMPERATURE",
  operator: ">",
  threshold: 35,
  actionCommand: "RELAY2:ON",
  cooldownSec: 30,
};

export default function AutomationPage() {
  const automationRules = useConnectionStore((s) => s.automationRules);
  const setAutomationRules = useConnectionStore((s) => s.setAutomationRules);
  const [schedules, setSchedules] = useState<
    Array<{
      id: string;
      name: string;
      timeOn: string;
      timeOff: string;
      command: string;
      commandOff: string;
      enabled: boolean;
    }>
  >([]);

  useEffect(() => {
    if (automationRules.length === 0) {
      setAutomationRules([
        {
          id: "demo-1",
          name: "Fan above 35°C",
          enabled: true,
          sensorType: "TEMPERATURE",
          operator: ">",
          threshold: 35,
          actionCommand: "RELAY2:ON",
          cooldownSec: 30,
        },
        {
          id: "demo-2",
          name: "Lights on motion",
          enabled: true,
          sensorType: "MOTION",
          operator: "==",
          threshold: 1,
          actionCommand: "RELAY1:ON",
          cooldownSec: 10,
        },
      ]);
    }
  }, [automationRules.length, setAutomationRules]);

  function onCreate(values: FormValues) {
    const rule: AutomationRuleLike = {
      id: `rule-${Date.now()}`,
      name: values.name,
      enabled: true,
      sensorType: values.sensorType,
      operator: values.operator,
      threshold: Number(values.threshold),
      actionCommand: values.actionCommand,
      cooldownSec: Number(values.cooldownSec),
    };
    setAutomationRules([rule, ...automationRules]);
    toast.success("Rule added");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400/80">
          Rules Engine
        </p>
        <h1 className="page-title mt-2 text-3xl text-white md:text-4xl">
          Automation & Scheduling
        </h1>
        <p className="mt-2 text-slate-400">
          IF sensor condition THEN send Arduino command. Plus daily on/off timers.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New Automation Rule</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                onCreate({
                  name: String(fd.get("name") || defaults.name),
                  sensorType: String(fd.get("sensorType") || defaults.sensorType),
                  operator: String(fd.get("operator") || defaults.operator),
                  threshold: Number(fd.get("threshold") || defaults.threshold),
                  actionCommand: String(
                    fd.get("actionCommand") || defaults.actionCommand
                  ),
                  cooldownSec: Number(fd.get("cooldownSec") || defaults.cooldownSec),
                });
                e.currentTarget.reset();
              }}
            >
              <div className="sm:col-span-2">
                <Label>Name</Label>
                <Input className="mt-1" name="name" defaultValue={defaults.name} required />
              </div>
              <div>
                <Label>Sensor</Label>
                <Input className="mt-1" name="sensorType" defaultValue={defaults.sensorType} />
              </div>
              <div>
                <Label>Operator</Label>
                <Input
                  className="mt-1"
                  name="operator"
                  defaultValue={defaults.operator}
                  placeholder=">"
                />
              </div>
              <div>
                <Label>Threshold</Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="any"
                  name="threshold"
                  defaultValue={defaults.threshold}
                />
              </div>
              <div>
                <Label>Cooldown (sec)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  name="cooldownSec"
                  defaultValue={defaults.cooldownSec}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Action Command</Label>
                <Input
                  className="mt-1"
                  name="actionCommand"
                  defaultValue={defaults.actionCommand}
                />
              </div>
              <Button type="submit" className="sm:col-span-2">
                Add Rule
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {automationRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-white">{rule.name}</div>
                  <div className="text-xs text-slate-500">
                    IF {rule.sensorType} {rule.operator} {rule.threshold} THEN{" "}
                    {rule.actionCommand}
                  </div>
                </div>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(v) =>
                    setAutomationRules(
                      automationRules.map((r) =>
                        r.id === rule.id ? { ...r, enabled: v } : r
                      )
                    )
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 md:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setSchedules((s) => [
                {
                  id: `sch-${Date.now()}`,
                  name: String(fd.get("name")),
                  timeOn: String(fd.get("timeOn")),
                  timeOff: String(fd.get("timeOff")),
                  command: String(fd.get("command")),
                  commandOff: String(fd.get("commandOff")),
                  enabled: true,
                },
                ...s,
              ]);
              toast.success("Schedule added");
              e.currentTarget.reset();
            }}
          >
            <Input name="name" placeholder="Relay schedule" required />
            <Input name="timeOn" type="time" required />
            <Input name="timeOff" type="time" required />
            <Input name="command" placeholder="RELAY1:ON" required />
            <Input name="commandOff" placeholder="RELAY1:OFF" required />
            <Button type="submit" className="md:col-span-5">
              Add Daily Schedule
            </Button>
          </form>
          {schedules.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm"
            >
              <div className="font-medium text-white">{s.name}</div>
              <div className="text-slate-400">
                ON {s.timeOn} → {s.command} · OFF {s.timeOff} → {s.commandOff}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
