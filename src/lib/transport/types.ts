export type ConnectionStatus =
  | "disconnected"
  | "scanning"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type TransportKind = "ble" | "web-serial" | "classic-bt" | "bridge";

export interface DeviceInfo {
  id: string;
  name: string;
  transport: TransportKind;
  signalStrength?: number;
  firmwareVersion?: string;
  connectedAt?: number;
}

export interface TransportMessage {
  data: string;
  timestamp: number;
  raw?: Uint8Array;
}

export interface TransportCapabilities {
  canScan: boolean;
  canReconnect: boolean;
  requiresSecureContext: boolean;
  label: string;
  description: string;
}

export type TransportEventMap = {
  status: ConnectionStatus;
  message: TransportMessage;
  device: DeviceInfo | null;
  error: string;
  peers: { remotes: number; hostOnline: boolean; deviceName?: string };
};

export type TransportListener<K extends keyof TransportEventMap> = (
  payload: TransportEventMap[K]
) => void;

export interface ITransport {
  readonly kind: TransportKind;
  readonly capabilities: TransportCapabilities;
  connect(options?: Record<string, unknown>): Promise<DeviceInfo>;
  disconnect(): Promise<void>;
  send(data: string): Promise<void>;
  getStatus(): ConnectionStatus;
  getDevice(): DeviceInfo | null;
  on<K extends keyof TransportEventMap>(
    event: K,
    listener: TransportListener<K>
  ): () => void;
}

export abstract class BaseTransport implements ITransport {
  abstract readonly kind: TransportKind;
  abstract readonly capabilities: TransportCapabilities;

  protected status: ConnectionStatus = "disconnected";
  protected device: DeviceInfo | null = null;
  private listeners: {
    [K in keyof TransportEventMap]?: Set<TransportListener<K>>;
  } = {};

  abstract connect(options?: Record<string, unknown>): Promise<DeviceInfo>;
  abstract disconnect(): Promise<void>;
  abstract send(data: string): Promise<void>;

  getStatus() {
    return this.status;
  }

  getDevice() {
    return this.device;
  }

  on<K extends keyof TransportEventMap>(
    event: K,
    listener: TransportListener<K>
  ) {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as never;
    }
    (this.listeners[event] as Set<TransportListener<K>>).add(listener);
    return () => {
      (this.listeners[event] as Set<TransportListener<K>>).delete(listener);
    };
  }

  protected emit<K extends keyof TransportEventMap>(
    event: K,
    payload: TransportEventMap[K]
  ) {
    const set = this.listeners[event] as Set<TransportListener<K>> | undefined;
    set?.forEach((l) => l(payload));
  }

  protected setStatus(status: ConnectionStatus) {
    this.status = status;
    this.emit("status", status);
  }
}
