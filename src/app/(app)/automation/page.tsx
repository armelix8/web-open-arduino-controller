"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { InfoHint } from "@/components/ui/info-hint";
import { useConnectionStore } from "@/lib/store/connection";
import { useUiMode } from "@/lib/store/ui-mode";
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

const OPERATORS: Array<{ value: string; label: string }> = [
  { value: ">", label: "is greater than ( > )" },
  { value: ">=", label: "is at least ( ≥ )" },
  { value: "<", label: "is less than ( < )" },
  { value: "<=", label: "is at most ( ≤ )" },
  { value: "==", label: "equals ( = )" },
  { value: "!=", label: "is not ( ≠ )" },
];

const selectClass =
  "flex h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50";

/** Renders a rule in the plain IF … THEN … format. */
function RuleView({ rule }: { rule: AutomationRuleLike }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-semibold text-cyan-300">
        IF
      </span>
      <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">
        {rule.sensorType}
      </span>
      <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-200">
        {rule.operator}
      </span>
      <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">
        {rule.threshold}
      </span>
      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-semibold text-emerald-300">
        THEN
      </span>
      <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">
        {rule.actionCommand}
      </span>
    </div>
  );
}

export default function AutomationPage() {
  const automationRules = useConnectionStore((s) => s.automationRules);
  const setAutomationRules = useConnectionStore((s) => s.setAutomationRules);
  const advanced = useUiMode((s) => s.mode === "advanced");
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
          Automation
        </h1>
        <p className="mt-2 text-slate-400">
          Make your Arduino react automatically:{" "}
          <span className="font-semibold text-cyan-300">IF</span> a sensor
          condition is met,{" "}
          <span className="font-semibold text-emerald-300">THEN</span> send a
          command.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New Automation Rule</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
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
              <div>
                <Label>Rule name</Label>
                <Input className="mt-1" name="name" defaultValue={defaults.name} required />
              </div>

              <div className="space-y-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  IF (condition)
                  <InfoHint
                    label="IF"
                    text="Choose a sensor, a condition, and a value to watch for."
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Sensor</Label>
                    <Input
                      className="mt-1"
                      name="sensorType"
                      list="sensor-list"
                      defaultValue={defaults.sensorType}
                    />
                  </div>
                  <div>
                    <Label>Condition</Label>
                    <select
                      name="operator"
                      defaultValue={defaults.operator}
                      className={`${selectClass} mt-1`}
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Value</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      step="any"
                      name="threshold"
                      defaultValue={defaults.threshold}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                  THEN (action)
                </div>
                <div>
                  <Label>Arduino action</Label>
                  <Input
                    className="mt-1"
                    name="actionCommand"
                    list="action-list"
                    defaultValue={defaults.actionCommand}
                  />
                </div>
              </div>

              {advanced && (
                <div>
                  <Label className="flex items-center gap-1.5">
                    Cooldown (sec)
                    <InfoHint
                      label="Cooldown"
                      text="Minimum seconds between repeats so the rule doesn't fire too often."
                    />
                  </Label>
                  <Input
                    className="mt-1"
                    type="number"
                    name="cooldownSec"
                    defaultValue={defaults.cooldownSec}
                  />
                </div>
              )}

              <Button type="submit" className="w-full">
                Add Rule
              </Button>

              <datalist id="sensor-list">
                <option value="TEMPERATURE" />
                <option value="HUMIDITY" />
                <option value="MOTION" />
                <option value="LIGHT" />
                <option value="DISTANCE" />
              </datalist>
              <datalist id="action-list">
                <option value="RELAY1:ON" />
                <option value="RELAY1:OFF" />
                <option value="RELAY2:ON" />
                <option value="RELAY2:OFF" />
                <option value="LED_ON" />
                <option value="LED_OFF" />
                <option value="MOTOR_START" />
                <option value="MOTOR_STOP" />
              </datalist>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {automationRules.length === 0 && (
              <div className="text-sm text-slate-500">No rules yet.</div>
            )}
            {automationRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="text-sm font-medium text-white">{rule.name}</div>
                  <RuleView rule={rule} />
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

      {advanced && (
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
      )}
    </div>
  );
}
