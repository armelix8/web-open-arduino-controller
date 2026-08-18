"use client";

import { useConnectionStore } from "@/lib/store/connection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadText } from "@/lib/utils";
import { toast } from "sonner";

export default function HistoryPage() {
  const terminal = useConnectionStore((s) => s.terminal);
  const exportTerminal = useConnectionStore((s) => s.exportTerminal);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-400/80">
            Logs
          </p>
          <h1 className="page-title mt-2 text-3xl text-white md:text-4xl">
            History
          </h1>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            downloadText(exportTerminal(), `history-${Date.now()}.log`);
            toast.success("Exported");
          }}
        >
          Export Log
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Session Communication Log</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[600px] space-y-2 overflow-y-auto font-mono text-xs">
          {terminal.length === 0 && (
            <div className="text-slate-500">No history in this session.</div>
          )}
          {[...terminal].reverse().map((e) => (
            <div key={e.id} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <span className="text-slate-600">
                {new Date(e.timestamp).toLocaleString()}
              </span>{" "}
              <span
                className={
                  e.direction === "tx"
                    ? "text-cyan-300"
                    : e.direction === "rx"
                      ? "text-emerald-300"
                      : "text-amber-300"
                }
              >
                {e.direction.toUpperCase()} {e.message}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
