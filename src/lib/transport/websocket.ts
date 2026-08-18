import {
  BaseTransport,
  type DeviceInfo,
  type TransportCapabilities,
} from "./types";

export type BridgeRole = "remote" | "host";

type BridgeIncoming =
  | {
      type: "welcome";
      hostOnline: boolean;
      remotes: number;
      room?: string;
      multiDevice?: boolean;
      maxRemotes?: number;
    }
  | { type: "rx"; data: string; timestamp?: number }
  | { type: "tx"; data: string; timestamp?: number; from?: string }
  | { type: "status"; connected: boolean; deviceName?: string; deviceId?: string }
  | { type: "error"; message: string }
  | { type: "host_offline" }
  | {
      type: "peers";
      remotes: number;
      hostOnline: boolean;
      deviceName?: string;
      room?: string;
    }
  | { type: "pong"; remotes?: number; room?: string };

/**
 * WebSocket bridge transport — works on iPhone Safari.
 * Relays through the LAN bridge started with the dev server (port 3001).
 */
export class BridgeTransport extends BaseTransport {
  readonly kind = "bridge" as const;
  readonly capabilities: TransportCapabilities = {
    canScan: false,
    canReconnect: true,
    requiresSecureContext: false,
    label: "Remote (iPhone / LAN)",
    description:
      "Connect over Wi‑Fi to a desktop host that holds the Bluetooth link. Works on iPhone Safari.",
  };

  private socket: WebSocket | null = null;
  private url = "ws://localhost:3001";
  private role: BridgeRole = "remote";
  private room = "LOBBY";
  private autoReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private everConnected = false;
  private reconnectAttempts = 0;
  private deviceName?: string;
  private hostHandler:
    | ((data: string, from?: string) => Promise<void>)
    | null = null;

  /** Stop auto-reconnect (e.g. kicked as host by another tab). */
  stopReconnect() {
    this.autoReconnect = false;
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  static isSupported() {
    return typeof WebSocket !== "undefined";
  }

  static defaultUrl() {
    if (typeof window === "undefined") return "ws://localhost:3000/bridge";
    const host = window.location.hostname || "localhost";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const port = window.location.port;
    // Same origin /bridge — npm run dev proxy, or nginx in production.
    // Phones only need the app port (no separate :3001 firewall hole).
    const portPart =
      port && port !== "80" && port !== "443" ? `:${port}` : "";
    return `${proto}//${host}${portPart}/bridge`;
  }

  static createRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  setHostCommandHandler(
    handler: ((data: string, from?: string) => Promise<void>) | null
  ) {
    this.hostHandler = handler;
  }

  async connect(options?: {
    url?: string;
    role?: BridgeRole;
    room?: string;
    autoReconnect?: boolean;
    deviceName?: string;
  }): Promise<DeviceInfo> {
    if (!BridgeTransport.isSupported()) {
      throw new Error("WebSocket is not available in this browser.");
    }

    this.url = options?.url || BridgeTransport.defaultUrl();
    this.role = options?.role || "remote";
    this.room = (options?.room || "LOBBY")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12) || "LOBBY";
    this.autoReconnect = options?.autoReconnect ?? true;
    this.intentionalClose = false;
    this.everConnected = false;
    this.reconnectAttempts = 0;
    this.deviceName = options?.deviceName;
    this.setStatus("connecting");

    try {
      await this.openSocket();
    } catch (err) {
      this.autoReconnect = false;
      this.setStatus("error");
      throw err;
    }

    this.everConnected = true;
    const info: DeviceInfo = {
      id: `bridge-${this.role}-${this.room}`,
      name:
        this.role === "host"
          ? `Sharing room ${this.room}`
          : options?.deviceName || `Room ${this.room}`,
      transport: "bridge",
      connectedAt: Date.now(),
    };
    this.device = info;
    this.setStatus("connected");
    this.emit("device", info);
    return info;
  }

  private openSocket() {
    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };

      let socket: WebSocket;
      try {
        socket = new WebSocket(this.url);
      } catch (err) {
        finish(err instanceof Error ? err : new Error("Invalid bridge URL"));
        return;
      }

      this.socket = socket;

      const timeout = setTimeout(() => {
        socket.close();
        finish(
          new Error(
            `Cannot reach bridge at ${this.url}. Restart with npm run dev (starts the /bridge proxy) or run npm run bridge.`
          )
        );
      }, 8000);

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: "hello",
            role: this.role,
            room: this.room,
            deviceName: this.deviceName || "Arduino",
          })
        );
        // Resolve only after welcome/error so remotes know hostOnline
      };

      socket.onerror = () => {
        // onclose / timeout will settle if still pending
      };

      socket.onmessage = (event) => {
        const raw = String(event.data);
        void this.handleMessage(raw);
        if (settled) return;
        try {
          const msg = JSON.parse(raw) as BridgeIncoming;
          if (msg.type === "welcome") {
            clearTimeout(timeout);
            finish();
          } else if (msg.type === "error") {
            clearTimeout(timeout);
            finish(new Error(msg.message));
          }
        } catch {
          /* non-JSON — ignore for handshake */
        }
      };

      socket.onclose = () => {
        clearTimeout(timeout);
        this.socket = null;
        if (!settled) {
          finish(
            new Error(
              `Cannot reach bridge at ${this.url}. Restart with npm run dev (starts the /bridge proxy) or run npm run bridge.`
            )
          );
          return;
        }
        if (this.intentionalClose) {
          this.setStatus("disconnected");
          this.device = null;
          this.emit("device", null);
          return;
        }
        this.scheduleReconnect();
      };
    });
  }

  private scheduleReconnect() {
    if (!this.autoReconnect || this.intentionalClose || !this.everConnected) {
      if (!this.intentionalClose && this.status !== "disconnected") {
        this.setStatus("disconnected");
        this.device = null;
        this.emit("device", null);
      }
      return;
    }

    if (this.reconnectAttempts >= 8) {
      this.autoReconnect = false;
      this.setStatus("error");
      this.emit(
        "error",
        `Stopped retrying ${this.url}. Is the bridge running?`
      );
      this.setStatus("disconnected");
      this.device = null;
      this.emit("device", null);
      return;
    }

    this.reconnectAttempts += 1;
    this.setStatus("reconnecting");
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      void this.openSocket()
        .then(() => {
          this.reconnectAttempts = 0;
          this.setStatus("connected");
          if (this.device) {
            this.device = { ...this.device, connectedAt: Date.now() };
            this.emit("device", this.device);
          }
        })
        .catch(() => {
          this.scheduleReconnect();
        });
    }, Math.min(8000, 800 * this.reconnectAttempts));
  }

  private async handleMessage(raw: string) {
    let msg: BridgeIncoming;
    try {
      msg = JSON.parse(raw) as BridgeIncoming;
    } catch {
      this.emit("message", { data: raw, timestamp: Date.now() });
      return;
    }

    switch (msg.type) {
      case "welcome":
        if (msg.room) this.room = msg.room;
        this.emit("peers", {
          remotes: msg.remotes,
          hostOnline: msg.hostOnline,
        });
        if (this.role === "remote" && !msg.hostOnline) {
          this.emit(
            "error",
            `Joined room ${msg.room || this.room}, but no host is sharing yet. Ask the PC user to connect hardware and enable Share.`
          );
        }
        break;
      case "peers":
        this.emit("peers", {
          remotes: msg.remotes,
          hostOnline: msg.hostOnline,
          deviceName: msg.deviceName,
        });
        break;
      case "rx":
        if (this.role === "remote") {
          this.emit("message", {
            data: msg.data,
            timestamp: msg.timestamp || Date.now(),
          });
        }
        break;
      case "tx":
        if (this.role === "host" && this.hostHandler) {
          try {
            await this.hostHandler(msg.data, msg.from);
          } catch (err) {
            this.emit(
              "error",
              err instanceof Error ? err.message : "Host forward failed"
            );
          }
        }
        break;
      case "status":
        if (this.role === "remote") {
          if (msg.connected && msg.deviceName) {
            this.device = {
              id: msg.deviceId || "remote-device",
              name: msg.deviceName,
              transport: "bridge",
              connectedAt: Date.now(),
            };
            this.emit("device", this.device);
          } else if (!msg.connected) {
            this.emit("error", "Host stopped sharing the device");
          }
        }
        break;
      case "host_offline":
        if (this.role === "remote") {
          this.emit("error", "Desktop host went offline");
        }
        break;
      case "error":
        if (/took over|Another host/i.test(msg.message)) {
          this.stopReconnect();
        }
        this.emit("error", msg.message);
        break;
      default:
        break;
    }
  }

  publishRx(data: string) {
    this.sendRaw({ type: "rx", data, timestamp: Date.now() });
  }

  publishStatus(connected: boolean, deviceName?: string, deviceId?: string) {
    this.sendRaw({ type: "status", connected, deviceName, deviceId });
  }

  private sendRaw(payload: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  async send(data: string): Promise<void> {
    if (this.status !== "connected" || !this.socket) {
      throw new Error("Not connected to bridge");
    }
    if (this.role === "remote") {
      this.sendRaw({ type: "tx", data, timestamp: Date.now() });
    } else {
      this.sendRaw({ type: "tx_local", data, timestamp: Date.now() });
    }
  }

  async disconnect(): Promise<void> {
    this.intentionalClose = true;
    this.autoReconnect = false;
    this.everConnected = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      this.socket?.close();
    } catch {
      /* ignore */
    }
    this.socket = null;
    this.device = null;
    this.setStatus("disconnected");
    this.emit("device", null);
  }
}
