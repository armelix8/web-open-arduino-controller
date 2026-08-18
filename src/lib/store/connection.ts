import { create } from "zustand";
import {
  BridgeTransport,
  createTransport,
  detectBrowserSupport,
  type ConnectionStatus,
  type DeviceInfo,
  type ITransport,
  type TransportKind,
  type TransportMessage,
} from "@/lib/transport";
import { parseArduinoLine, type ParsedSensor } from "@/lib/protocol";
import { evaluateAutomation, type AutomationRuleLike } from "@/lib/automation";

export interface TerminalEntry {
  id: string;
  direction: "tx" | "rx" | "system";
  message: string;
  timestamp: number;
}

export interface LiveSensor {
  type: string;
  label: string;
  value: number;
  unit?: string;
  history: Array<{ t: number; v: number }>;
}

interface ConnectionStore {
  transportKind: TransportKind;
  status: ConnectionStatus;
  device: DeviceInfo | null;
  support: ReturnType<typeof detectBrowserSupport> | null;
  terminal: TerminalEntry[];
  autoScroll: boolean;
  sensors: Record<string, LiveSensor>;
  automationRules: AutomationRuleLike[];
  connectedDurationMs: number;
  bridgeUrl: string;
  bridgeRoom: string;
  sharing: boolean;
  remotePeers: number;
  hostOnline: boolean;

  setTransportKind: (kind: TransportKind) => void;
  setBridgeUrl: (url: string) => void;
  setBridgeRoom: (room: string) => void;
  setAutoScroll: (v: boolean) => void;
  setAutomationRules: (rules: AutomationRuleLike[]) => void;
  initSupport: () => void;
  /** Restore UI from the live transport after HMR / remount (does not reconnect). */
  rehydrate: () => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (message: string) => Promise<void>;
  startSharing: () => Promise<void>;
  stopSharing: () => Promise<void>;
  clearTerminal: () => void;
  exportTerminal: () => string;
  tickDuration: () => void;
}

type Runtime = {
  transport: ITransport | null;
  shareBridge: BridgeTransport | null;
  unsubscribers: Array<() => void>;
  shareUnsubscribers: Array<() => void>;
  hostTxQueue: Promise<void>;
  tabId: string;
};

function runtime(): Runtime {
  const g = globalThis as typeof globalThis & { __btArduinoRuntime?: Runtime };
  if (!g.__btArduinoRuntime) {
    g.__btArduinoRuntime = {
      transport: null,
      shareBridge: null,
      unsubscribers: [],
      shareUnsubscribers: [],
      hostTxQueue: Promise.resolve(),
      tabId: `tab-${Math.random().toString(36).slice(2, 10)}`,
    };
  }
  return g.__btArduinoRuntime;
}

function enqueueHostTx(task: () => Promise<void>) {
  const rt = runtime();
  rt.hostTxQueue = rt.hostTxQueue.then(task).catch(() => {
    /* keep queue alive */
  });
  return rt.hostTxQueue;
}

function clientLabel() {
  if (typeof window === "undefined") return "remote";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  return "Remote";
}

function addTerminal(
  set: (fn: (s: ConnectionStore) => Partial<ConnectionStore>) => void,
  direction: TerminalEntry["direction"],
  message: string
) {
  const entry: TerminalEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    direction,
    message,
    timestamp: Date.now(),
  };
  set((s) => ({
    terminal: [...s.terminal.slice(-499), entry],
  }));
}

function ingestSensors(
  set: (fn: (s: ConnectionStore) => Partial<ConnectionStore>) => void,
  get: () => ConnectionStore,
  sensors: ParsedSensor[]
) {
  const now = Date.now();
  set((s) => {
    const next = { ...s.sensors };
    for (const sensor of sensors) {
      const prev = next[sensor.type];
      const history = [...(prev?.history || []), { t: now, v: sensor.value }].slice(
        -60
      );
      next[sensor.type] = {
        type: sensor.type,
        label: sensor.label,
        value: sensor.value,
        unit: sensor.unit,
        history,
      };
    }
    return { sensors: next };
  });

  const triggers = evaluateAutomation(get().automationRules, sensors, now);
  for (const t of triggers) {
    void get().send(t.command);
    set((s) => ({
      automationRules: s.automationRules.map((r) =>
        r.id === t.rule.id ? { ...r, lastTriggeredAt: now } : r
      ),
    }));
    addTerminal(set, "system", `Automation "${t.rule.name}" → ${t.command}`);
  }
}

function defaultBridgeUrl() {
  if (typeof window === "undefined") return "ws://localhost:3000/bridge";
  return BridgeTransport.defaultUrl();
}

function bindTransportListeners(
  transport: ITransport,
  set: (
    partial:
      | Partial<ConnectionStore>
      | ((s: ConnectionStore) => Partial<ConnectionStore>)
  ) => void,
  get: () => ConnectionStore
) {
  const rt = runtime();
  rt.unsubscribers.forEach((u) => u());
  rt.unsubscribers = [
    transport.on("status", (status) => set({ status })),
    transport.on("device", (device) => set({ device, connectedDurationMs: 0 })),
    transport.on("error", (error) => addTerminal(set, "system", error)),
    transport.on("peers", (peers) =>
      set({ remotePeers: peers.remotes, hostOnline: peers.hostOnline })
    ),
    transport.on("message", (msg: TransportMessage) => {
      addTerminal(set, "rx", msg.data);
      const parsed = parseArduinoLine(msg.data);
      if (parsed.sensors) ingestSensors(set, get, parsed.sensors);
      runtime().shareBridge?.publishRx(msg.data);
    }),
  ];
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  transportKind: "ble",
  status: "disconnected",
  device: null,
  support: null,
  terminal: [],
  autoScroll: true,
  sensors: {},
  automationRules: [],
  connectedDurationMs: 0,
  bridgeUrl: "ws://localhost:3000/bridge",
  bridgeRoom: "",
  sharing: false,
  remotePeers: 0,
  hostOnline: false,

  setTransportKind: (kind) => {
    // Don't tear down an active link when remounting UI flips defaults (e.g. iOS)
    if (get().status === "connected" || get().status === "connecting") return;
    set({ transportKind: kind });
  },
  setBridgeUrl: (url) => set({ bridgeUrl: url }),
  setBridgeRoom: (room) =>
    set({
      bridgeRoom: room.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12),
    }),
  setAutoScroll: (v) => set({ autoScroll: v }),
  setAutomationRules: (rules) => set({ automationRules: rules }),

  initSupport: () => {
    const support = detectBrowserSupport();
    const { status, sharing } = get();
    const live = status === "connected" || status === "connecting" || sharing;
    const patch: Partial<ConnectionStore> = { support };
    // Refresh same-origin /bridge URL when idle (fixes stale :3001 URLs)
    if (!live) {
      patch.bridgeUrl = defaultBridgeUrl();
      if (support.ios) patch.transportKind = "bridge";
    }
    set(patch);
    get().rehydrate();
  },

  rehydrate: () => {
    const rt = runtime();
    if (!rt.transport) return;
    const status = rt.transport.getStatus();
    const device = rt.transport.getDevice();
    set({
      status,
      device,
      sharing: !!rt.shareBridge,
      transportKind: rt.transport.kind,
    });
    // Re-bind listeners after HMR replaced the store module
    bindTransportListeners(rt.transport, set, get);
  },

  connect: async () => {
    const rt = runtime();
    const { transportKind, bridgeUrl, bridgeRoom } = get();
    if (rt.transport) {
      await rt.transport.disconnect();
      rt.unsubscribers.forEach((u) => u());
      rt.unsubscribers = [];
    }

    const transport = createTransport(transportKind);
    rt.transport = transport;
    bindTransportListeners(transport, set, get);

    addTerminal(set, "system", `Connecting via ${transportKind}…`);

    try {
      if (transportKind === "bridge") {
        const room = (bridgeRoom || "").trim();
        if (!room) {
          throw new Error(
            "Enter the room code from the desktop Share panel, then Connect."
          );
        }
        await transport.connect({
          url: bridgeUrl || defaultBridgeUrl(),
          role: "remote",
          room,
          autoReconnect: true,
          deviceName: clientLabel(),
        });
      } else {
        await transport.connect({ autoReconnect: true });
      }
    } catch (err) {
      rt.unsubscribers.forEach((u) => u());
      rt.unsubscribers = [];
      try {
        await transport.disconnect();
      } catch {
        /* ignore */
      }
      rt.transport = null;
      set({
        status: "disconnected",
        device: null,
        remotePeers: 0,
        hostOnline: false,
      });
      throw err;
    }
    addTerminal(set, "system", "Connected");
  },

  disconnect: async () => {
    const rt = runtime();
    if (get().sharing) {
      await get().stopSharing();
    }
    if (!rt.transport) return;
    await rt.transport.disconnect();
    rt.unsubscribers.forEach((u) => u());
    rt.unsubscribers = [];
    rt.transport = null;
    set({
      status: "disconnected",
      device: null,
      connectedDurationMs: 0,
      remotePeers: 0,
      hostOnline: false,
    });
    addTerminal(set, "system", "Disconnected");
  },

  send: async (message) => {
    const rt = runtime();
    if (!rt.transport || get().status !== "connected") {
      throw new Error("Not connected");
    }
    await rt.transport.send(message);
    addTerminal(set, "tx", message);
  },

  startSharing: async () => {
    const rt = runtime();
    const { status, device, bridgeUrl, bridgeRoom } = get();
    if (status !== "connected" || !device) {
      throw new Error("Connect BLE / Classic BT / Serial on this desktop first");
    }
    if (device.transport === "bridge") {
      throw new Error(
        "This device is already a remote. Share from the desktop host."
      );
    }
    if (rt.shareBridge) {
      rt.shareUnsubscribers.forEach((u) => u());
      rt.shareUnsubscribers = [];
      await rt.shareBridge.disconnect();
      rt.shareBridge = null;
    }

    const room = bridgeRoom || BridgeTransport.createRoomCode();
    set({ bridgeRoom: room });

    rt.hostTxQueue = Promise.resolve();
    const bridge = new BridgeTransport();
    rt.shareBridge = bridge;
    bridge.setHostCommandHandler(async (data, from) => {
      await enqueueHostTx(async () => {
        if (!runtime().transport) throw new Error("Local transport gone");
        await runtime().transport!.send(data);
        addTerminal(set, "tx", data);
        addTerminal(set, "system", `${from || "Remote"} → ${data}`);
      });
    });

    rt.shareUnsubscribers.forEach((u) => u());
    rt.shareUnsubscribers = [
      bridge.on("peers", (peers) => {
        const prev = get().remotePeers;
        set({ remotePeers: peers.remotes, hostOnline: peers.hostOnline });
        if (peers.remotes !== prev) {
          addTerminal(set, "system", `Remotes online: ${peers.remotes}`);
        }
      }),
      bridge.on("error", (error) => {
        addTerminal(set, "system", error);
        // Another tab/host took the room — drop share only, keep BLE/Serial up
        if (/took over|Another host/i.test(error)) {
          bridge.stopReconnect();
          void get().stopSharing();
        }
      }),
      // Important: share bridge status must NOT overwrite the Arduino link status
      bridge.on("status", () => {
        /* ignore — sharing is tracked via `sharing` flag */
      }),
    ];

    try {
      await bridge.connect({
        url: bridgeUrl || defaultBridgeUrl(),
        role: "host",
        room,
        // Reconnect network blips, but stopReconnect() on takeover
        autoReconnect: true,
        deviceName: device.name,
      });
    } catch (err) {
      rt.shareUnsubscribers.forEach((u) => u());
      rt.shareUnsubscribers = [];
      rt.shareBridge = null;
      set({ sharing: false });
      throw err;
    }
    bridge.publishStatus(true, device.name, device.id);
    set({ sharing: true, hostOnline: true });
    addTerminal(
      set,
      "system",
      `Sharing room ${room} — others join Remote with this room code`
    );
  },

  stopSharing: async () => {
    const rt = runtime();
    rt.shareUnsubscribers.forEach((u) => u());
    rt.shareUnsubscribers = [];
    if (rt.shareBridge) {
      try {
        rt.shareBridge.publishStatus(false);
      } catch {
        /* ignore */
      }
      await rt.shareBridge.disconnect();
      rt.shareBridge = null;
    }
    set({ sharing: false, remotePeers: 0 });
    addTerminal(set, "system", "Stopped sharing to remotes");
  },

  clearTerminal: () => set({ terminal: [] }),

  exportTerminal: () => {
    return get()
      .terminal.map((e) => {
        const ts = new Date(e.timestamp).toISOString();
        const prefix =
          e.direction === "tx" ? ">>" : e.direction === "rx" ? "<<" : "--";
        return `[${ts}] ${prefix} ${e.message}`;
      })
      .join("\n");
  },

  tickDuration: () => {
    const { status, device } = get();
    if (status === "connected" && device?.connectedAt) {
      set({ connectedDurationMs: Date.now() - device.connectedAt });
    }
  },
}));
