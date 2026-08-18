import {
  BaseTransport,
  type DeviceInfo,
  type TransportCapabilities,
} from "./types";

/** Nordic UART Service (NUS) — common for ESP32 / HM-10 BLE firmwares */
export const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
export const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export class BleTransport extends BaseTransport {
  readonly kind = "ble" as const;
  readonly capabilities: TransportCapabilities = {
    canScan: true,
    canReconnect: true,
    requiresSecureContext: true,
    label: "Web Bluetooth (BLE)",
    description:
      "Connect to HM-10 (BLE mode), ESP32 BLE, and other GATT UART devices.",
  };

  private deviceRef: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null;
  private txChar: BluetoothRemoteGATTCharacteristic | null = null;
  private decoder = new TextDecoder();
  private buffer = "";
  private autoReconnect = true;
  private reconnectAttempts = 0;

  static isSupported() {
    return isWebBluetoothAvailable();
  }

  async connect(options?: {
    serviceUuid?: string;
    filters?: BluetoothLEScanFilter[];
    autoReconnect?: boolean;
  }): Promise<DeviceInfo> {
    if (!BleTransport.isSupported()) {
      throw new Error(
        "Web Bluetooth is not available. Use Chrome, Edge, or Android Chrome over HTTPS."
      );
    }

    this.autoReconnect = options?.autoReconnect ?? true;
    this.setStatus("scanning");

    try {
      const serviceUuid = options?.serviceUuid || NUS_SERVICE;
      // acceptAllDevices: Chrome only lists devices that match `filters`.
      // Many modules (ESP32, HM-10) advertise a name but not the UART UUID
      // until after connect — so a NUS-only filter looks like an empty list.
      const device = await navigator.bluetooth.requestDevice(
        options?.filters
          ? {
              filters: options.filters,
              optionalServices: [serviceUuid, NUS_SERVICE],
            }
          : {
              acceptAllDevices: true,
              optionalServices: [serviceUuid, NUS_SERVICE],
            }
      );

      this.deviceRef = device;
      device.addEventListener("gattserverdisconnected", () =>
        this.handleDisconnect()
      );

      this.setStatus("connecting");
      await this.attachGatt(device, serviceUuid);

      const info: DeviceInfo = {
        id: device.id,
        name: device.name || "BLE Device",
        transport: "ble",
        connectedAt: Date.now(),
      };
      this.device = info;
      this.reconnectAttempts = 0;
      this.setStatus("connected");
      this.emit("device", info);
      return info;
    } catch (err) {
      this.setStatus("error");
      const message = err instanceof Error ? err.message : "BLE connection failed";
      this.emit("error", message);
      throw err;
    }
  }

  private async attachGatt(device: BluetoothDevice, serviceUuid: string) {
    const server = await device.gatt!.connect();
    this.server = server;

    let service: BluetoothRemoteGATTService;
    try {
      service = await server.getPrimaryService(serviceUuid);
    } catch {
      try {
        service = await server.getPrimaryService(NUS_SERVICE);
      } catch {
        throw new Error(
          "Connected, but this device has no Nordic UART service. Flash the ESP32 BLE sketch from /arduino/esp32_ble, or use Web Serial for HC-05/USB."
        );
      }
    }

    try {
      this.rxChar = await service.getCharacteristic(NUS_RX);
    } catch {
      const chars = await service.getCharacteristics();
      this.rxChar =
        chars.find((c) => c.properties.write || c.properties.writeWithoutResponse) ||
        null;
    }

    try {
      this.txChar = await service.getCharacteristic(NUS_TX);
    } catch {
      const chars = await service.getCharacteristics();
      this.txChar =
        chars.find((c) => c.properties.notify || c.properties.indicate) || null;
    }

    if (this.txChar) {
      await this.txChar.startNotifications();
      this.txChar.addEventListener(
        "characteristicvaluechanged",
        this.onNotification
      );
    }
  }

  private onNotification = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;
    const chunk = this.decoder.decode(value, { stream: true });
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      this.emit("message", {
        data: trimmed,
        timestamp: Date.now(),
        raw: new Uint8Array(value.buffer),
      });
    }
  };

  private async handleDisconnect() {
    if (this.status === "disconnected") return;
    this.txChar?.removeEventListener(
      "characteristicvaluechanged",
      this.onNotification
    );
    this.rxChar = null;
    this.txChar = null;
    this.server = null;

    if (this.autoReconnect && this.deviceRef) {
      this.setStatus("reconnecting");
      while (this.reconnectAttempts < 5 && this.autoReconnect) {
        this.reconnectAttempts += 1;
        try {
          await new Promise((r) => setTimeout(r, 1000 * this.reconnectAttempts));
          await this.attachGatt(this.deviceRef, NUS_SERVICE);
          if (this.device) {
            this.device = { ...this.device, connectedAt: Date.now() };
            this.emit("device", this.device);
          }
          this.setStatus("connected");
          this.reconnectAttempts = 0;
          return;
        } catch {
          // retry
        }
      }
    }

    this.setStatus("disconnected");
    this.device = null;
    this.emit("device", null);
  }

  async disconnect(): Promise<void> {
    this.autoReconnect = false;
    this.txChar?.removeEventListener(
      "characteristicvaluechanged",
      this.onNotification
    );
    if (this.deviceRef?.gatt?.connected) {
      this.deviceRef.gatt.disconnect();
    }
    this.deviceRef = null;
    this.server = null;
    this.rxChar = null;
    this.txChar = null;
    this.device = null;
    this.setStatus("disconnected");
    this.emit("device", null);
  }

  async send(data: string): Promise<void> {
    if (!this.rxChar || this.status !== "connected") {
      throw new Error("Not connected");
    }
    const encoder = new TextEncoder();
    const payload = encoder.encode(data.endsWith("\n") ? data : `${data}\n`);
    const chunkSize = 20;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      if (this.rxChar.properties.writeWithoutResponse) {
        await this.rxChar.writeValueWithoutResponse(chunk);
      } else {
        await this.rxChar.writeValue(chunk);
      }
    }
  }
}
