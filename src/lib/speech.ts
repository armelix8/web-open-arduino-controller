import { isIosDevice } from "@/lib/transport";

export type SpeechRecognitionCtor = new () => SpeechRecognition;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

/** Prefer the system keyboard dictation mic (iPhone) over Web Speech API. */
export function preferKeyboardDictation(): boolean {
  if (typeof window === "undefined") return false;
  if (isIosDevice()) return true;
  if (!window.isSecureContext) return true;
  if (!getSpeechRecognitionCtor()) return true;
  if (isStandaloneDisplay()) return true;
  return false;
}

export function describeSpeechBlocker(): string | null {
  if (typeof window === "undefined") return null;
  // Keyboard dictation path — not a hard block, just guidance
  if (preferKeyboardDictation()) {
    return null;
  }
  return null;
}

export function keyboardDictationHint(): string {
  return "Tap the field, then tap the microphone on your keyboard to dictate.";
}

export function speechErrorMessage(error: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone / speech permission denied. Allow access in iOS Settings → Safari.";
    case "network":
      return "Speech needs internet (Apple/Google cloud recognition).";
    case "no-speech":
      return "No speech heard — try again.";
    case "audio-capture":
      return "No microphone available.";
    case "aborted":
      return "Listening cancelled.";
    default:
      return `Speech error: ${error}`;
  }
}
