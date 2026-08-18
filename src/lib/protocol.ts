export type ParsedSensor = {
  type: string;
  label: string;
  value: number;
  unit?: string;
};

const SENSOR_PATTERNS: Array<{
  type: string;
  label: string;
  unit?: string;
  re: RegExp;
}> = [
  { type: "TEMPERATURE", label: "Temperature", unit: "°C", re: /^(?:TEMP|T)[:=]\s*(-?\d+(?:\.\d+)?)/i },
  { type: "HUMIDITY", label: "Humidity", unit: "%", re: /^(?:HUM|H)[:=]\s*(-?\d+(?:\.\d+)?)/i },
  { type: "DISTANCE", label: "Distance", unit: "cm", re: /^(?:DIST|D)[:=]\s*(-?\d+(?:\.\d+)?)/i },
  { type: "LIGHT", label: "Light", unit: "lx", re: /^(?:LIGHT|LUX)[:=]\s*(-?\d+(?:\.\d+)?)/i },
  { type: "PRESSURE", label: "Pressure", unit: "hPa", re: /^(?:PRESS|PRESSURE)[:=]\s*(-?\d+(?:\.\d+)?)/i },
  { type: "VOLTAGE", label: "Voltage", unit: "V", re: /^(?:VOLT|V)[:=]\s*(-?\d+(?:\.\d+)?)/i },
  { type: "CURRENT", label: "Current", unit: "A", re: /^(?:CURR|I)[:=]\s*(-?\d+(?:\.\d+)?)/i },
  { type: "BATTERY", label: "Battery", unit: "%", re: /^(?:BAT|BATTERY)[:=]\s*(-?\d+(?:\.\d+)?)/i },
  { type: "GAS", label: "Gas", unit: "ppm", re: /^(?:GAS)[:=]\s*(-?\d+(?:\.\d+)?)/i },
  { type: "MOTION", label: "Motion", re: /^(?:MOTION|PIR)[:=]\s*(-?\d+|ON|OFF|YES|NO|TRUE|FALSE)/i },
  { type: "WATER_LEVEL", label: "Water Level", unit: "%", re: /^(?:WATER|LEVEL)[:=]\s*(-?\d+(?:\.\d+)?)/i },
  { type: "RPM", label: "RPM", unit: "rpm", re: /^(?:RPM)[:=]\s*(-?\d+(?:\.\d+)?)/i },
];

function parseMotionValue(raw: string): number {
  const u = raw.toUpperCase();
  if (["ON", "YES", "TRUE", "1"].includes(u)) return 1;
  if (["OFF", "NO", "FALSE", "0"].includes(u)) return 0;
  return Number(raw);
}

export function parseArduinoLine(line: string): {
  kind: "ok" | "error" | "sensor" | "status" | "raw";
  sensors?: ParsedSensor[];
  message: string;
} {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "raw", message: trimmed };

  if (/^OK\b/i.test(trimmed)) return { kind: "ok", message: trimmed };
  if (/^ERROR\b/i.test(trimmed)) return { kind: "error", message: trimmed };
  if (/^STATUS[:=]/i.test(trimmed)) return { kind: "status", message: trimmed };

  const sensors: ParsedSensor[] = [];

  // Multi-value: TEMP:27.5,HUM:65
  const parts = trimmed.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    for (const pattern of SENSOR_PATTERNS) {
      const m = part.match(pattern.re);
      if (m) {
        const rawVal = m[1];
        const value =
          pattern.type === "MOTION"
            ? parseMotionValue(rawVal)
            : Number(rawVal);
        if (!Number.isNaN(value)) {
          sensors.push({
            type: pattern.type,
            label: pattern.label,
            value,
            unit: pattern.unit,
          });
        }
        break;
      }
    }
  }

  if (sensors.length > 0) {
    return { kind: "sensor", sensors, message: trimmed };
  }

  return { kind: "raw", message: trimmed };
}

export const PROTOCOL_COMMANDS = {
  LED_ON: "LED_ON",
  LED_OFF: "LED_OFF",
  MOTOR_START: "MOTOR_START",
  MOTOR_STOP: "MOTOR_STOP",
  STOP: "STOP",
  FORWARD: "FORWARD",
  BACKWARD: "BACKWARD",
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  servo: (deg: number) => `SERVO:${Math.round(deg)}`,
  pwm: (value: number) => `PWM:${Math.round(value)}`,
  relay: (n: number, on: boolean) => `RELAY${n}:${on ? "ON" : "OFF"}`,
  rgb: (r: number, g: number, b: number) =>
    `RGB:${Math.round(r)},${Math.round(g)},${Math.round(b)}`,
  joystick: (x: number, y: number) => `JOY:${Math.round(x)},${Math.round(y)}`,
  tempQuery: "TEMP?",
  statusQuery: "STATUS?",
} as const;

export const VOICE_COMMAND_MAP: Record<string, string> = {
  "turn on led": "LED_ON",
  "led on": "LED_ON",
  "turn off led": "LED_OFF",
  "led off": "LED_OFF",
  "move forward": "FORWARD",
  forward: "FORWARD",
  "move backward": "BACKWARD",
  backward: "BACKWARD",
  left: "LEFT",
  right: "RIGHT",
  stop: "STOP",
  "stop motor": "MOTOR_STOP",
  "start motor": "MOTOR_START",
  "turn on fan": "RELAY2:ON",
  "turn off fan": "RELAY2:OFF",
  "turn on lights": "RELAY1:ON",
  "turn off lights": "RELAY1:OFF",
};

export function mapVoiceToCommand(transcript: string): string | null {
  const normalized = transcript.toLowerCase().trim();
  const phrases = Object.entries(VOICE_COMMAND_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [phrase, command] of phrases) {
    if (normalized.includes(phrase)) return command;
  }
  return null;
}
