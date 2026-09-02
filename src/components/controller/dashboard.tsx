"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Mic,
  OctagonX,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { InfoHint } from "@/components/ui/info-hint";
import { useConnectionStore } from "@/lib/store/connection";
import { useUiMode } from "@/lib/store/ui-mode";
import { useMounted } from "@/lib/use-mounted";
import { HELP } from "@/lib/help-text";
import { PROTOCOL_COMMANDS, mapVoiceToCommand } from "@/lib/protocol";
import {
  getSpeechRecognitionCtor,
  keyboardDictationHint,
  preferKeyboardDictation,
  speechErrorMessage,
} from "@/lib/speech";

async function safeSend(send: (m: string) => Promise<void>, cmd: string) {
  try {
    await send(cmd);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Send failed");
  }
}

/** Labelled group of related controls. */
function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
        <span aria-hidden>{emoji}</span>
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export function ControllerDashboard() {
  const send = useConnectionStore((s) => s.send);
  const status = useConnectionStore((s) => s.status);
  const mounted = useMounted();
  const connected = mounted && status === "connected";
  const mode = useUiMode((s) => s.mode);
  const advanced = mode === "advanced";
  const [pwm, setPwm] = useState(128);
  const [servo, setServo] = useState(90);
  const [relays, setRelays] = useState({
    r1: false,
    r2: false,
    fan: false,
    pump: false,
  });
  const [rgb, setRgb] = useState({ r: 255, g: 120, b: 50 });
  const [keypad, setKeypad] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [useKeyboardMic, setUseKeyboardMic] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const voiceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentPhraseRef = useRef("");
  const joyRef = useRef<HTMLDivElement>(null);
  const [joy, setJoy] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setUseKeyboardMic(preferKeyboardDictation());
  }, []);

  useEffect(() => {
    return () => {
      if (voiceDebounceRef.current) clearTimeout(voiceDebounceRef.current);
    };
  }, []);

  const fire = useCallback(
    (cmd: string) => {
      if (!connected) {
        toast.error("Connect a device first");
        return;
      }
      void safeSend(send, cmd);
    },
    [connected, send]
  );

  function runPhrase(phrase: string, opts?: { silentUnrecognized?: boolean }) {
    const trimmed = phrase.trim();
    if (!trimmed) return false;
    const cmd = mapVoiceToCommand(trimmed);
    if (cmd) {
      if (lastSentPhraseRef.current === trimmed) return true;
      lastSentPhraseRef.current = trimmed;
      fire(cmd);
      toast.success(`Voice: ${trimmed} → ${cmd}`);
      setVoiceText("");
      return true;
    }
    if (!opts?.silentUnrecognized) {
      toast.message(`Unrecognized: ${trimmed}`);
    }
    return false;
  }

  function openKeyboardMicField() {
    const el = voiceInputRef.current;
    if (!el) return;
    el.focus({ preventScroll: false });
    // iOS: help keyboard appear; sites cannot start dictation mic programmatically
    try {
      el.setSelectionRange(el.value.length, el.value.length);
    } catch {
      /* ignore */
    }
    toast.message(keyboardDictationHint());
  }

  function onVoiceFieldChange(value: string) {
    setVoiceText(value);
    if (voiceDebounceRef.current) clearTimeout(voiceDebounceRef.current);
    // After keyboard dictation pauses, auto-send if the phrase maps to a command
    voiceDebounceRef.current = setTimeout(() => {
      runPhrase(value, { silentUnrecognized: true });
    }, 700);
  }

  function onJoyPointer(e: React.PointerEvent) {
    if (!joyRef.current || !connected) return;
    const rect = joyRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2)));
    const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2)));
    const x = Math.round(((dx + 1) / 2) * 255);
    const y = Math.round(((1 - dy) / 2) * 255);
    setJoy({ x, y });
    void safeSend(send, PROTOCOL_COMMANDS.joystick(x, y));
  }

  function startVoice() {
    if (useKeyboardMic) {
      openKeyboardMicField();
      return;
    }

    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      setUseKeyboardMic(true);
      openKeyboardMicField();
      return;
    }

    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceText(transcript);
      runPhrase(transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setUseKeyboardMic(true);
        openKeyboardMicField();
        return;
      }
      if (event.error !== "aborted") {
        toast.error(speechErrorMessage(event.error));
      }
    };
    recognition.onend = () => setListening(false);

    try {
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
      setUseKeyboardMic(true);
      openKeyboardMicField();
    }
  }

  function submitTypedCommand() {
    const phrase = voiceText.trim();
    if (!phrase) {
      openKeyboardMicField();
      return;
    }
    lastSentPhraseRef.current = "";
    runPhrase(phrase);
  }

  return (
    <div className="space-y-6">
      <Button
        variant="danger"
        className="w-full"
        disabled={!connected}
        onClick={() => fire("STOP")}
      >
        <OctagonX size={16} />
        Emergency Stop
      </Button>

      <Section emoji="💡" title="Lights">
        <Card>
          <CardHeader>
            <CardTitle>LED</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button disabled={!connected} onClick={() => fire("LED_ON")}>
              LED ON
            </Button>
            <Button
              variant="secondary"
              disabled={!connected}
              onClick={() => fire("LED_OFF")}
            >
              LED OFF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              RGB Color
              <InfoHint label="RGB" text={HELP.rgb} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="color"
              className="h-12 w-full cursor-pointer rounded-xl border border-white/10 bg-transparent"
              value={`#${[rgb.r, rgb.g, rgb.b]
                .map((v) => v.toString(16).padStart(2, "0"))
                .join("")}`}
              disabled={!connected}
              onChange={(e) => {
                const hex = e.target.value;
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                setRgb({ r, g, b });
                fire(PROTOCOL_COMMANDS.rgb(r, g, b));
              }}
            />
            <div className="font-mono text-xs text-slate-400">
              {rgb.r},{rgb.g},{rgb.b}
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section emoji="⚙️" title="Motors & Motion">
        <Card>
          <CardHeader>
            <CardTitle>Motor</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button
              variant="success"
              disabled={!connected}
              onClick={() => fire("MOTOR_START")}
            >
              Motor Start
            </Button>
            <Button
              variant="secondary"
              disabled={!connected}
              onClick={() => fire("MOTOR_STOP")}
            >
              Motor Stop
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Servo Control
              <InfoHint label="Servo" text={HELP.servo} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm text-slate-400">
              <span>Position</span>
              <span className="text-cyan-300">{servo}°</span>
            </div>
            <Slider
              value={[servo]}
              min={0}
              max={180}
              step={1}
              disabled={!connected}
              onValueChange={([v]) => setServo(v)}
              onValueCommit={([v]) => fire(PROTOCOL_COMMANDS.servo(v))}
            />
            <div className="flex flex-wrap gap-2">
              {[0, 45, 90, 135, 180].map((deg) => (
                <Button
                  key={deg}
                  size="sm"
                  variant="secondary"
                  disabled={!connected}
                  onClick={() => {
                    setServo(deg);
                    fire(PROTOCOL_COMMANDS.servo(deg));
                  }}
                >
                  {deg}°
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              PWM / Brightness
              <InfoHint label="PWM" text={HELP.pwm} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm text-slate-400">
              <span>0 – 255</span>
              <span className="text-cyan-300">{pwm}</span>
            </div>
            <Slider
              value={[pwm]}
              min={0}
              max={255}
              step={1}
              disabled={!connected}
              onValueChange={([v]) => setPwm(v)}
              onValueCommit={([v]) => fire(PROTOCOL_COMMANDS.pwm(v))}
            />
          </CardContent>
        </Card>
      </Section>

      <Section emoji="🔌" title="Outputs">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Relays &amp; Outputs
              <InfoHint label="Relay" text={HELP.relay} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                ["Relay 1", "r1", 1],
                ["Relay 2", "r2", 2],
                ["Fan", "fan", 3],
                ["Pump", "pump", 4],
              ] as const
            ).map(([label, key, n]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-slate-300">{label}</span>
                <Switch
                  checked={relays[key]}
                  disabled={!connected}
                  onCheckedChange={(v) => {
                    setRelays((s) => ({ ...s, [key]: v }));
                    fire(PROTOCOL_COMMANDS.relay(n, v));
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </Section>

      <Section emoji="🎮" title="Input &amp; Controls">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Joystick
              <InfoHint label="Joystick" text={HELP.joystick} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={joyRef}
              onPointerDown={onJoyPointer}
              onPointerMove={(e) => e.buttons === 1 && onJoyPointer(e)}
              onPointerUp={() => {
                setJoy({ x: 128, y: 128 });
                if (connected) fire(PROTOCOL_COMMANDS.joystick(128, 128));
              }}
              className="relative mx-auto aspect-square w-48 cursor-crosshair touch-none rounded-full border border-cyan-400/30 bg-gradient-to-br from-slate-900 to-slate-800 shadow-inner"
            >
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]" />
            </div>
            <div className="mt-3 text-center font-mono text-xs text-slate-400">
              X={joy.x} · Y={joy.y}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Direction Pad</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 place-items-center gap-2">
            <div />
            <Button
              size="icon"
              disabled={!connected}
              onClick={() => fire("FORWARD")}
            >
              <ArrowUp size={18} />
            </Button>
            <div />
            <Button size="icon" disabled={!connected} onClick={() => fire("LEFT")}>
              <ArrowLeft size={18} />
            </Button>
            <Button
              size="icon"
              variant="danger"
              disabled={!connected}
              onClick={() => fire("STOP")}
            >
              <Square size={16} />
            </Button>
            <Button
              size="icon"
              disabled={!connected}
              onClick={() => fire("RIGHT")}
            >
              <ArrowRight size={18} />
            </Button>
            <div />
            <Button
              size="icon"
              disabled={!connected}
              onClick={() => fire("BACKWARD")}
            >
              <ArrowDown size={18} />
            </Button>
            <div />
          </CardContent>
        </Card>

        {advanced && (
          <Card>
            <CardHeader>
              <CardTitle>Keypad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={keypad} readOnly placeholder="Entry" />
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(
                  (k) => (
                    <Button
                      key={k}
                      variant="secondary"
                      disabled={!connected}
                      onClick={() => setKeypad((v) => v + k)}
                    >
                      {k}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  disabled={!connected}
                  onClick={() => setKeypad("")}
                >
                  Cancel
                </Button>
                <Button
                  className="col-span-2"
                  disabled={!connected || !keypad}
                  onClick={() => {
                    fire(`KEYPAD:${keypad}`);
                    setKeypad("");
                  }}
                >
                  OK
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {advanced && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                Voice Command
                <InfoHint
                  label="Voice"
                  text="Speak or type a phrase like “turn on led” to send a command."
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs text-slate-300">
                {useKeyboardMic
                  ? keyboardDictationHint()
                  : "Uses browser speech. On iPhone, the keyboard mic is used instead."}
              </div>
              <Input
                ref={voiceInputRef}
                value={voiceText}
                onChange={(e) => onVoiceFieldChange(e.target.value)}
                onFocus={() => {
                  lastSentPhraseRef.current = "";
                }}
                placeholder='Tap here → keyboard mic → "turn on led"'
                disabled={!connected}
                lang="en-US"
                inputMode="text"
                enterKeyHint="send"
                autoCapitalize="sentences"
                autoCorrect="on"
                autoComplete="off"
                spellCheck
                className="h-12 text-base"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitTypedCommand();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant={listening ? "success" : "secondary"}
                  disabled={!connected}
                  onClick={startVoice}
                >
                  <Mic size={16} />
                  {useKeyboardMic
                    ? "Open keyboard"
                    : listening
                      ? "Listening…"
                      : "Speak a command"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!connected}
                  onClick={submitTypedCommand}
                >
                  Send
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Try: “Turn on LED”, “Move Forward”, “Stop Motor”
              </p>
            </CardContent>
          </Card>
        )}
      </Section>

      {mode === "beginner" && (
        <p className="text-xs text-slate-500">
          🛠️ Switch to <span className="text-slate-300">Advanced</span> mode (left
          sidebar) to show Keypad, Voice, and custom commands.
        </p>
      )}
    </div>
  );
}
