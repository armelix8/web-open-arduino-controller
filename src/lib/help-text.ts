/**
 * Short, beginner-friendly explanations for technical terms shown via the ⓘ hints.
 * Keep each one to a single plain sentence.
 */
export const HELP = {
  pwm: "PWM — control LED brightness or motor speed.",
  servo: "Servo — move a motor to a specific angle.",
  relay: "Relay — turn another electrical device ON or OFF.",
  ble: "BLE — a low-power wireless connection.",
  serial: "Serial — communication between the app and your Arduino.",
  joystick: "Joystick — send X/Y direction values, like a game controller.",
  rgb: "RGB — mix red, green and blue to set a color.",
} as const;

export type HelpKey = keyof typeof HELP;
