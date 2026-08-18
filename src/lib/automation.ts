import type { ParsedSensor } from "./protocol";

export type AutomationOperator = ">" | ">=" | "<" | "<=" | "==" | "!=";

export interface AutomationRuleLike {
  id: string;
  name: string;
  enabled: boolean;
  sensorType: string;
  operator: AutomationOperator | string;
  threshold: number;
  actionCommand: string;
  cooldownSec: number;
  lastTriggeredAt?: number | null;
}

export function evaluateCondition(
  value: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
    case "==":
      return value === threshold;
    case "!=":
      return value !== threshold;
    default:
      return false;
  }
}

export function evaluateAutomation(
  rules: AutomationRuleLike[],
  sensors: ParsedSensor[],
  now = Date.now()
): Array<{ rule: AutomationRuleLike; command: string }> {
  const triggers: Array<{ rule: AutomationRuleLike; command: string }> = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const sensor = sensors.find((s) => s.type === rule.sensorType);
    if (!sensor) continue;

    const last = rule.lastTriggeredAt ?? 0;
    if (now - last < rule.cooldownSec * 1000) continue;

    if (evaluateCondition(sensor.value, rule.operator, rule.threshold)) {
      triggers.push({ rule, command: rule.actionCommand });
    }
  }

  return triggers;
}

export function isScheduleDue(
  schedule: {
    type: string;
    enabled: boolean;
    timeOn?: string | null;
    timeOff?: string | null;
    daysOfWeek?: number[];
    cron?: string | null;
    lastRunAt?: number | null;
  },
  now = new Date()
): { due: boolean; commandPhase?: "on" | "off" } {
  if (!schedule.enabled) return { due: false };

  const day = now.getDay();
  if (
    schedule.type === "WEEKLY" &&
    schedule.daysOfWeek &&
    schedule.daysOfWeek.length > 0 &&
    !schedule.daysOfWeek.includes(day) // number[] or parsed JSON array
  ) {
    return { due: false };
  }

  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (schedule.timeOn === hhmm) return { due: true, commandPhase: "on" };
  if (schedule.timeOff === hhmm) return { due: true, commandPhase: "off" };

  return { due: false };
}
