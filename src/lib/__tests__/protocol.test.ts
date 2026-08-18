import { describe, expect, it } from "vitest";
import { parseArduinoLine, mapVoiceToCommand } from "@/lib/protocol";
import {
  evaluateAutomation,
  evaluateCondition,
  isScheduleDue,
} from "@/lib/automation";

describe("parseArduinoLine", () => {
  it("parses OK/ERROR", () => {
    expect(parseArduinoLine("OK").kind).toBe("ok");
    expect(parseArduinoLine("ERROR").kind).toBe("error");
  });

  it("parses temperature and humidity", () => {
    const parsed = parseArduinoLine("TEMP:27.5,HUM:65");
    expect(parsed.kind).toBe("sensor");
    expect(parsed.sensors).toHaveLength(2);
    expect(parsed.sensors?.[0].value).toBe(27.5);
    expect(parsed.sensors?.[1].value).toBe(65);
  });

  it("parses motion flags", () => {
    const parsed = parseArduinoLine("MOTION:ON");
    expect(parsed.sensors?.[0].value).toBe(1);
  });
});

describe("voice mapping", () => {
  it("maps common phrases", () => {
    expect(mapVoiceToCommand("please turn on LED now")).toBe("LED_ON");
    expect(mapVoiceToCommand("Move Forward")).toBe("FORWARD");
    expect(mapVoiceToCommand("stop motor")).toBe("MOTOR_STOP");
  });
});

describe("automation engine", () => {
  it("evaluates operators", () => {
    expect(evaluateCondition(36, ">", 35)).toBe(true);
    expect(evaluateCondition(35, ">", 35)).toBe(false);
    expect(evaluateCondition(1, "==", 1)).toBe(true);
  });

  it("triggers rules with cooldown", () => {
    const triggers = evaluateAutomation(
      [
        {
          id: "1",
          name: "fan",
          enabled: true,
          sensorType: "TEMPERATURE",
          operator: ">",
          threshold: 35,
          actionCommand: "RELAY2:ON",
          cooldownSec: 30,
        },
      ],
      [{ type: "TEMPERATURE", label: "Temperature", value: 36, unit: "°C" }]
    );
    expect(triggers).toHaveLength(1);
    expect(triggers[0].command).toBe("RELAY2:ON");
  });

  it("detects schedule due times", () => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    const due = isScheduleDue(
      {
        type: "DAILY",
        enabled: true,
        timeOn: hhmm,
        timeOff: "23:59",
      },
      now
    );
    expect(due.due).toBe(true);
    expect(due.commandPhase).toBe("on");
  });
});
