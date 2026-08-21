"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bluetooth, Cable, Unplug, Smartphone, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useConnectionStore } from "@/lib/store/connection";
import { formatDuration } from "@/lib/utils";
import type { TransportKind } from "@/lib/transport";

export function ConnectionPanel() {
  const [ready, setReady] = useState(false);
  const support = useConnectionStore((s) => s.support);
  const status = useConnectionStore((s) => s.status);
  const device = useConnectionStore((s) => s.device);
  const transportKind = useConnectionStore((s) => s.transportKind);
  const setTransportKind = useConnectionStore((s) => s.setTransportKind);
  const bridgeUrl = useConnectionStore((s) => s.bridgeUrl);
  const setBridgeUrl = useConnectionStore((s) => s.setBridgeUrl);
  const bridgeRoom = useConnectionStore((s) => s.bridgeRoom);
  const setBridgeRoom = useConnectionStore((s) => s.setBridgeRoom);
  const sharing = useConnectionStore((s) => s.sharing);
  const remotePeers = useConnectionStore((s) => s.remotePeers);
  const hostOnline = useConnectionStore((s) => s.hostOnline);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const startSharing = useConnectionStore((s) => s.startSharing);
  const stopSharing = useConnectionStore((s) => s.stopSharing);
  const initSupport = useConnectionStore((s) => s.initSupport);
  const rehydrate = useConnectionStore((s) => s.rehydrate);
  const connectedDurationMs = useConnectionStore((s) => s.connectedDurationMs);

  useEffect(() => {
    initSupport();
    rehydrate();
    setReady(true);
  }, [initSupport, rehydrate]);

  const isIos = !!support?.ios;

  useEffect(() => {
    if (status !== "disconnected" || sharing) return;
    // iPhone / iPad: always Remote (no mode tab). Desktop: never leave Remote selected.
    if (isIos && transportKind !== "bridge") {
      setTransportKind("bridge");
    } else if (!isIos && transportKind === "bridge") {
      setTransportKind("ble");
    }
  }, [isIos, transportKind, setTransportKind, status, sharing]);

  async function handleConnect() {
    try {
      await connect();
      const state = useConnectionStore.getState();
      if (state.transportKind === "bridge") {
        if (state.hostOnline) {
          toast.success("Connected to host");
        } else {
          toast.message(
            "Joined room — waiting for desktop to enable Share"
          );
        }
      } else {
        toast.success("Device connected");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    }
  }

  async function handleDisconnect() {
    await disconnect();
    toast.message("Disconnected");
  }

  async function toggleShare(v: boolean) {
    try {
      if (v) {
        await startSharing();
        toast.success("Sharing to devices");
      } else {
        await stopSharing();
        toast.message("Sharing stopped");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Share failed");
    }
  }

  // Remote is automatic on iPhone — never show it as a desktop transport tab.
  const modes: Array<{
    kind: TransportKind;
    label: string;
    enabled: boolean;
    icon: "ble" | "classic" | "serial";
  }> = isIos
    ? []
    : [
        { kind: "ble", label: "BLE", enabled: !!support?.ble, icon: "ble" },
        {
          kind: "classic-bt",
          label: "Classic BT",
          enabled: !!support?.classicBt,
          icon: "classic",
        },
        {
          kind: "web-serial",
          label: "USB Serial",
          enabled: !!support?.serial,
          icon: "serial",
        },
      ];

  const connectDisabled =
    !ready ||
    status === "scanning" ||
    status === "connecting" ||
    (transportKind === "ble" && !support?.ble) ||
    (transportKind === "classic-bt" && !support?.classicBt) ||
    (transportKind === "web-serial" && !support?.serial) ||
    (transportKind === "bridge" && !support?.bridge) ||
    (transportKind === "bridge" && !bridgeRoom);

  const canShare =
    status === "connected" &&
    device?.transport !== "bridge" &&
    (transportKind === "ble" ||
      transportKind === "web-serial" ||
      transportKind === "classic-bt");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isIos ? "iPhone Remote" : "Device Connection"}
        </CardTitle>
        <CardDescription>
          {isIos
            ? "This iPhone connects over Wi‑Fi to your PC. Enter the Share room code from the computer."
            : "BLE for GATT modules. Classic BT for HC-05/HC-06 (pair in Windows first). USB Serial for adapters. Share to send control to phones."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ready && isIos && (
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
            <p className="font-medium">On your PC first</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-cyan-100/90">
              <li>Open this app in Chrome</li>
              <li>Connect with BLE or Web Serial</li>
              <li>Turn on Share to iPhone</li>
              <li>Then tap Connect Remote below</li>
            </ol>
          </div>
        )}

        {ready && support?.unsupportedReason && !support.ios && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {support.unsupportedReason}
          </div>
        )}

        {ready && support?.ble && transportKind === "ble" && (
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-400">
            Chrome shows a system picker (not an in-app list). Power the module,
            keep it unpaired if possible, and pick it there.
          </div>
        )}

        {ready && support?.classicBt && transportKind === "classic-bt" && (
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-xs text-slate-300">
            <p className="font-medium text-cyan-100">Classic Bluetooth (HC-05 / HC-06)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-slate-400">
              <li>Pair the module in Windows Settings → Bluetooth (PIN often 1234)</li>
              <li>Confirm a COM port appears under More Bluetooth settings → COM ports</li>
              <li>Tap Scan &amp; Connect and choose that Bluetooth serial port</li>
            </ol>
            <p className="mt-2 text-slate-500">
              Browsers cannot scan classic BT like BLE — pair in Windows first.
              If the SPP list is empty, choose <span className="text-slate-300">USB Serial</span> and pick the Bluetooth COM port.
            </p>
          </div>
        )}

        {modes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {modes.map((m) => (
              <Button
                key={m.kind}
                size="sm"
                variant={transportKind === m.kind ? "default" : "secondary"}
                disabled={!ready || !m.enabled}
                onClick={() => setTransportKind(m.kind)}
              >
                {m.icon === "ble" && <Bluetooth size={14} />}
                {m.icon === "classic" && <Bluetooth size={14} />}
                {m.icon === "serial" && <Cable size={14} />}
                {m.label}
              </Button>
            ))}
          </div>
        )}

        {(transportKind === "bridge" || canShare || sharing) && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Room code</Label>
              <Input
                value={bridgeRoom}
                onChange={(e) => setBridgeRoom(e.target.value)}
                placeholder="e.g. K7M2QX"
                autoCapitalize="characters"
                autoCorrect="off"
                disabled={sharing || (transportKind === "bridge" && status === "connected")}
              />
              <p className="text-xs text-slate-500">
                Desktop: leave empty when enabling Share to auto-generate a code.
                Phone: enter that exact room code, then Connect Remote.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Bridge URL</Label>
              <Input
                value={bridgeUrl}
                onChange={(e) => setBridgeUrl(e.target.value)}
                placeholder="ws://…/bridge"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <p className="text-xs text-slate-500">
                Defaults to same-origin <code className="text-slate-400">/bridge</code>{" "}
                (works on phone without opening port 3001).
              </p>
            </div>
          </div>
        )}

        {canShare && !isIos && (
          <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <Share2 size={16} className="text-cyan-300" />
                Share to devices
              </div>
              <Switch checked={sharing} onCheckedChange={toggleShare} />
            </div>
            {sharing && (
              <div className="space-y-1 text-xs text-cyan-200/90">
                <p>
                  Room{" "}
                  <span className="font-mono text-base tracking-widest text-white">
                    {bridgeRoom || "—"}
                  </span>
                  {" · "}
                  {remotePeers} remote{remotePeers === 1 ? "" : "s"}
                </p>
                <p className="text-slate-400">
                  Others open this site → Remote → enter the same room → Connect
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(bridgeRoom);
                      toast.success("Room code copied");
                    } catch {
                      toast.message(bridgeRoom);
                    }
                  }}
                >
                  Copy room code
                </Button>
              </div>
            )}
          </div>
        )}

        {transportKind === "bridge" && status === "connected" && (
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs text-slate-300">
            Room {bridgeRoom || "LOBBY"} · {remotePeers} peer
            {remotePeers === 1 ? "" : "s"} · host{" "}
            {hostOnline ? "online" : "offline"}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Status" value={status} />
          <Info label="Device Name" value={device?.name || "—"} />
          <Info label="Device ID" value={device?.id || "—"} />
          <Info
            label="Connected Time"
            value={
              status === "connected"
                ? formatDuration(connectedDurationMs)
                : "—"
            }
          />
          <Info label="Transport" value={device?.transport || transportKind} />
          <Info
            label="Remotes"
            value={sharing || transportKind === "bridge" ? String(remotePeers) : "—"}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {status === "connected" || status === "reconnecting" ? (
            <Button variant="danger" onClick={handleDisconnect}>
              <Unplug size={16} />
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={connectDisabled}>
              {transportKind === "bridge" ? (
                <Smartphone size={16} />
              ) : (
                <Bluetooth size={16} />
              )}
              {status === "scanning" || status === "connecting"
                ? "Connecting…"
                : transportKind === "bridge"
                  ? "Connect Remote"
                  : "Scan & Connect"}
            </Button>
          )}
          <Badge className="self-center capitalize">{status}</Badge>
          {sharing && (
            <Badge className="self-center">
              Sharing · {remotePeers} remote{remotePeers === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm text-white">{value}</div>
    </div>
  );
}
