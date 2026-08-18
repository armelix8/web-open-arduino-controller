import os from "os";

export function lanIPv4() {
  const ips = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      const family = a.family === "IPv4" || a.family === 4;
      if (family && !a.internal) ips.push(a.address);
    }
  }
  return ips;
}
