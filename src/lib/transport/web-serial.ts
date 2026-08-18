import {
  BaseTransport,
  type DeviceInfo,
  type TransportCapabilities,
} from "./types";

function isWebSerialAvailable(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/**
 * Web Serial transport for HC-05/HC-06 modules exposed as USB-UART
 * (USB-TTL adapter or boards that enumerate as a serial port).
 * Classic Bluetooth SPP is not reachable from the browser Web Bluetooth API.
 */
export class WebSerialTransport extends BaseTransport {
  readonly kind = "web-serial" as const;
  readonly capabilities: TransportCapabilities = {
    canScan: true,
    canReconnect: true,
    requiresSecureContext: true,
    label: "Web Serial (USB / HC-05 bridge)",
    description:
      "Use with HC-05/HC-06 connected via USB-TTL, or a local serial bridge.",
  };

  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readLoopActive = false;
  private decoder = new TextDecoder();
  private buffer = "";
  private baudRate = 9600;
  private autoReconnect = true;

  static isSupported() {
    return isWebSerialAvailable();
  }

  async connect(options?: {
    baudRate?: number;
    autoReconnect?: boolean;
  }): Promise<DeviceInfo> {
    if (!WebSerialTransport.isSupported()) {
      throw new Error(
        "Web Serial is not available. Use Chrome/Edge over HTTPS, or a companion bridge for Bluetooth Classic."
      );
    }

    this.baudRate = options?.baudRate ?? 9600;
    this.autoReconnect = options?.autoReconnect ?? true;
    this.setStatus("scanning");

    try {
      const port = await navigator.serial.requestPort();
      this.setStatus("connecting");
      await port.open({ baudRate: this.baudRate });
      this.port = port;
      this.writer = port.writable!.getWriter();
      this.startReadLoop();

      port.addEventListener("disconnect", () => this.handleDisconnect());

      const info: DeviceInfo = {
        id: `serial-${Date.now()}`,
        name: "Serial Device",
        transport: "web-serial",
        connectedAt: Date.now(),
      };
      this.device = info;
      this.setStatus("connected");
      this.emit("device", info);
      return info;
    } catch (err) {
      this.setStatus("error");
      const message =
        err instanceof Error ? err.message : "Serial connection failed";
      this.emit("error", message);
      throw err;
    }
  }

  private async startReadLoop() {
    if (!this.port?.readable) return;
    this.readLoopActive = true;
    this.reader = this.port.readable.getReader();
    try {
      while (this.readLoopActive) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (!value) continue;
        this.buffer += this.decoder.decode(value, { stream: true });
        const lines = this.buffer.split(/\r?\n/);
        this.buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          this.emit("message", {
            data: trimmed,
            timestamp: Date.now(),
            raw: value,
          });
        }
      }
    } catch {
      if (this.readLoopActive) await this.handleDisconnect();
    } finally {
      try {
        this.reader?.releaseLock();
      } catch {
        /* ignore */
      }
      this.reader = null;
    }
  }

  private async handleDisconnect() {
    this.readLoopActive = false;
    if (this.status === "disconnected") return;

    if (this.autoReconnect && this.port) {
      this.setStatus("reconnecting");
      try {
        await this.port.open({ baudRate: this.baudRate });
        this.writer = this.port.writable!.getWriter();
        this.startReadLoop();
        if (this.device) {
          this.device = { ...this.device, connectedAt: Date.now() };
          this.emit("device", this.device);
        }
        this.setStatus("connected");
        return;
      } catch {
        /* fall through */
      }
    }

    await this.cleanup();
    this.setStatus("disconnected");
    this.device = null;
    this.emit("device", null);
  }

  private async cleanup() {
    this.readLoopActive = false;
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    try {
      this.writer?.releaseLock();
    } catch {
      /* ignore */
    }
    try {
      await this.port?.close();
    } catch {
      /* ignore */
    }
    this.reader = null;
    this.writer = null;
    this.port = null;
  }

  async disconnect(): Promise<void> {
    this.autoReconnect = false;
    await this.cleanup();
    this.device = null;
    this.setStatus("disconnected");
    this.emit("device", null);
  }

  async send(data: string): Promise<void> {
    if (!this.writer || this.status !== "connected") {
      throw new Error("Not connected");
    }
    const encoder = new TextEncoder();
    const payload = encoder.encode(data.endsWith("\n") ? data : `${data}\n`);
    await this.writer.write(payload);
  }
}
