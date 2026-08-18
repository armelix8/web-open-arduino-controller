"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useConnectionStore } from "@/lib/store/connection";
import { downloadText } from "@/lib/utils";

export function SerialTerminal() {
  const terminal = useConnectionStore((s) => s.terminal);
  const autoScroll = useConnectionStore((s) => s.autoScroll);
  const setAutoScroll = useConnectionStore((s) => s.setAutoScroll);
  const clearTerminal = useConnectionStore((s) => s.clearTerminal);
  const exportTerminal = useConnectionStore((s) => s.exportTerminal);
  const send = useConnectionStore((s) => s.send);
  const status = useConnectionStore((s) => s.status);
  const [cmd, setCmd] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminal, autoScroll]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cmd.trim()) return;
    try {
      await send(cmd.trim());
      toast.success("Command sent");
      setCmd("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    }
  }

  return (
    <Card className="flex h-full min-h-[360px] flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Serial Terminal</CardTitle>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Auto Scroll
            <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
          </label>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              downloadText(exportTerminal(), `terminal-${Date.now()}.log`);
              toast.success("Log exported");
            }}
          >
            <Download size={16} />
          </Button>
          <Button size="icon" variant="ghost" onClick={clearTerminal}>
            <Trash2 size={16} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs leading-6">
          {terminal.length === 0 && (
            <div className="text-slate-500">No messages yet…</div>
          )}
          {terminal.map((e) => (
            <div key={e.id} className="flex gap-2">
              <span className="shrink-0 text-slate-600">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={
                  e.direction === "tx"
                    ? "text-cyan-300"
                    : e.direction === "rx"
                      ? "text-emerald-300"
                      : "text-amber-300"
                }
              >
                {e.direction === "tx" ? ">>" : e.direction === "rx" ? "<<" : "--"}{" "}
                {e.message}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            placeholder="Send command…"
            disabled={status !== "connected"}
          />
          <Button type="submit" disabled={status !== "connected"}>
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
