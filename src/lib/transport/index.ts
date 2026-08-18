import { BleTransport } from "./ble";
import { WebSerialTransport } from "./web-serial";
import { ClassicBluetoothTransport } from "./classic-bt";
import { BridgeTransport } from "./websocket";
import type { ITransport, TransportKind } from "./types";

export * from "./types";
export { BleTransport, NUS_SERVICE, NUS_RX, NUS_TX } from "./ble";
export { WebSerialTransport } from "./web-serial";
export {
  ClassicBluetoothTransport,
  SPP_SERVICE_CLASS,
} from "./classic-bt";
export { BridgeTransport } from "./websocket";

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

export function detectBrowserSupport() {
  const ble = BleTransport.isSupported();
  const serial = WebSerialTransport.isSupported();
  const classicBt = ClassicBluetoothTransport.isSupported();
  const bridge = BridgeTransport.isSupported();
  const ios = isIosDevice();
  const isSecure =
    typeof window !== "undefined" ? window.isSecureContext : true;

  let unsupportedReason: string | null = null;
  if (ios) {
    unsupportedReason =
      "iPhone/iPad Safari cannot use Web Bluetooth or Classic BT. Use Remote (iPhone) mode: connect BLE/Classic/Serial on the PC, then Share to iPhone.";
  } else if (!isSecure) {
    unsupportedReason =
      "This page is not a secure context (http://LAN-IP). Web Bluetooth / Classic BT need https:// or http://localhost — open http://localhost:3000 on this PC (Chrome).";
  } else if (!ble && !serial && !classicBt && !bridge) {
    unsupportedReason =
      "No supported transports in this browser. Use Chrome/Edge on desktop, or Remote bridge mode.";
  }

  return {
    ble,
    serial,
    classicBt,
    bridge,
    ios,
    isSecure,
    anySupported: ble || serial || classicBt || bridge,
    unsupportedReason,
  };
}

export function createTransport(kind: TransportKind): ITransport {
  switch (kind) {
    case "ble":
      return new BleTransport();
    case "web-serial":
      return new WebSerialTransport();
    case "classic-bt":
      return new ClassicBluetoothTransport();
    case "bridge":
      return new BridgeTransport();
    default:
      throw new Error(`Unknown transport: ${kind}`);
  }
}
