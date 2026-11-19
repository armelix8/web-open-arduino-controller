"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useConnectionStore } from "@/lib/store/connection";
import { useMounted } from "@/lib/use-mounted";
import { useEffect, useState } from "react";

type CustomCmd = {
  id: string;
  name: string;
  command: string;
  color: string;
  icon: string;
  shortcut: string;
};

type Form = {
  name: string;
  command: string;
  color: string;
  icon: string;
  shortcut: string;
};

export function CustomCommands() {
  const send = useConnectionStore((s) => s.send);
  const status = useConnectionStore((s) => s.status);
  const mounted = useMounted();
  const connected = mounted && status === "connected";
  const [items, setItems] = useState<CustomCmd[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("bt-custom-commands");
    if (raw) setItems(JSON.parse(raw) as CustomCmd[]);
  }, []);

  useEffect(() => {
    localStorage.setItem("bt-custom-commands", JSON.stringify(items));
  }, [items]);

  function onCreate(values: Form) {
    const item: CustomCmd = { id: `c-${Date.now()}`, ...values };
    setItems((s) => [item, ...s]);
    toast.success("Custom command saved");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      const match = items.find(
        (i) => i.shortcut && i.shortcut.toLowerCase() === e.key.toLowerCase()
      );
      if (match && status === "connected") {
        void send(match.command);
        toast.message(`Shortcut ${match.shortcut} → ${match.command}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, send, status]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Create Custom Command</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              onCreate({
                name: String(fd.get("name") || ""),
                command: String(fd.get("command") || ""),
                color: String(fd.get("color") || "#22d3ee"),
                icon: String(fd.get("icon") || "zap"),
                shortcut: String(fd.get("shortcut") || ""),
              });
              e.currentTarget.reset();
            }}
          >
            <div>
              <Label>Button Name</Label>
              <Input className="mt-1" name="name" required />
            </div>
            <div>
              <Label>Arduino Command</Label>
              <Input className="mt-1" name="command" required />
            </div>
            <div>
              <Label>Color</Label>
              <Input className="mt-1" type="color" name="color" defaultValue="#22d3ee" />
            </div>
            <div>
              <Label>Icon</Label>
              <Input className="mt-1" name="icon" defaultValue="zap" />
            </div>
            <div className="sm:col-span-2">
              <Label>Shortcut Key</Label>
              <Input className="mt-1" name="shortcut" placeholder="e.g. l" />
            </div>
            <Button type="submit" className="sm:col-span-2">
              Save Command
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Your Buttons</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {items.length === 0 && (
            <div className="col-span-2 text-sm text-slate-500">No custom commands yet.</div>
          )}
          {items.map((item) => (
            <Button
              key={item.id}
              style={{ background: item.color, color: "#041016" }}
              disabled={!connected}
              onClick={async () => {
                try {
                  await send(item.command);
                  toast.success("Sent");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              {item.name}
              {item.shortcut ? ` [${item.shortcut}]` : ""}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
