import {
  BaseTransport,
  type DeviceInfo,
  type TransportCapabilities,
} from "./types";

/** Bluetooth Serial Port Profile (SPP / RFCOMM) */
export const SPP_SERVICE_CLASS = 0x1101;

function isWebSerialAvailable(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/**
 * Classic Bluetooth (HC-05 / HC-06) over Web Serial.
 * Browsers cannot use classic BT via Web Bluetooth — after you pair the module
 * in Windows, Chrome exposes it as a serial port (SPP).
 */
export class ClassicBluetoothTransport extends BaseTransport {
  readonly kind = "classic-bt" as const;
  readonly capabilities: TransportCapabilities = {
    canScan: true,
    canReconnect: true,
    requiresSecureContext: true,
    label: "Classic Bluetooth (HC-05 / HC-06)",
    description:
      "Pair the module in Windows, then pick its COM / Bluetooth serial port.",
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
    if (!ClassicBluetoothTransport.isSupported()) {
      throw new Error(
        "Classic Bluetooth needs Web Serial (Chrome/Edge on http://localhost or HTTPS)."
      );
    }

    this.baudRate = options?.baudRate ?? 9600;
    this.autoReconnect = options?.autoReconnect ?? true;
    this.setStatus("scanning");

    try {
      const port = await this.requestClassicPort();
      this.setStatus("connecting");
      await port.open({ baudRate: this.baudRate });
      this.port = port;
      this.writer = port.writable!.getWriter();
      this.startReadLoop();

      port.addEventListener("disconnect", () => this.handleDisconnect());

      const info: DeviceInfo = {
        id: `classic-bt-${Date.now()}`,
        name: await this.portDisplayName(port),
        transport: "classic-bt",
        connectedAt: Date.now(),
      };
      this.device = info;
      this.setStatus("connected");
      this.emit("device", info);
      return info;
    } catch (err) {
      this.setStatus("error");
      const message =
        err instanceof Error ? err.message : "Classic Bluetooth connection failed";
      this.emit("error", message);
      throw err;
    }
  }

  private async requestClassicPort(): Promise<SerialPort> {
    // Paired classic modules show up as COM / serial ports. One picker is clearer
    // than SPP-filter → empty → second dialog (cancel looks the same as empty).
    return navigator.serial.requestPort();
  }

  private async portDisplayName(port: SerialPort): Promise<string> {
    try {
      const info = await port.getInfo?.();
      if (info?.bluetoothServiceClassId != null) {
        return `Classic BT (SPP 0x${info.bluetoothServiceClassId.toString(16)})`;
      }
      if (info?.usbVendorId != null) {
        return `Serial USB ${info.usbVendorId.toString(16)}:${(info.usbProductId ?? 0).toString(16)}`;
      }
    } catch {
      /* ignore */
    }
    return "Classic Bluetooth";
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
