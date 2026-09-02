export type OSKind =
  | "windows"
  | "macos"
  | "ios"
  | "android"
  | "chromeos"
  | "linux"
  | "unknown";

/**
 * Best-effort client OS detection. Order matters: Android and ChromeOS user
 * agents also contain "Linux", so they are checked first.
 */
export function detectOS(): OSKind {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  const uaData = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData;
  const platform = (uaData?.platform || navigator.platform || "").toLowerCase();

  if (/android/i.test(ua)) return "android";

  const isIpadOS =
    navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
  if (/iphone|ipad|ipod/i.test(ua) || isIpadOS) return "ios";

  if (/\bcros\b/i.test(ua)) return "chromeos";
  if (platform.includes("win") || /windows/i.test(ua)) return "windows";
  if (platform.includes("mac") || /mac os x|macintosh/i.test(ua)) return "macos";
  if (platform.includes("linux") || /linux/i.test(ua)) return "linux";
  return "unknown";
}

export interface BluetoothSettingsTarget {
  label: string;
  /** URL / URI scheme that opens the OS Bluetooth settings. */
  url: string;
}

/**
 * Returns a deep link that opens the OS Bluetooth settings, or null when the
 * platform has no reliable web-usable scheme (macOS, iOS, Linux, ChromeOS…).
 */
export function bluetoothSettingsFor(
  os: OSKind
): BluetoothSettingsTarget | null {
  switch (os) {
    case "windows":
      return {
        label: "Open Windows Bluetooth settings",
        url: "ms-settings:bluetooth",
      };
    case "android":
      return {
        label: "Open Android Bluetooth settings",
        url: "intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end",
      };
    default:
      return null;
  }
}
