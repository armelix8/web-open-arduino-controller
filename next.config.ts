import os from "os";
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

function lanDevOrigins() {
  const hosts = ["localhost", "127.0.0.1", "*.local"];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      const v4 = a.family === "IPv4" || a.family === 4;
      if (v4 && !a.internal) hosts.push(a.address);
    }
  }
  // Allow the dev server to be reached through remote tunnels (Cloudflare Tunnel,
  // ngrok) so BLE/Serial work over HTTPS from other devices. Next.js otherwise
  // rejects cross-origin dev/HMR requests from these hosts, which leaves the page
  // non-interactive. Extra origins can be added via DEV_ALLOWED_ORIGINS (comma-separated).
  hosts.push("*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io");
  const extra = (process.env.DEV_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  hosts.push(...extra);
  return hosts;
}

// SW is disabled in `next dev` so HMR keeps working. Production `next start` enables PWA.
// Override: ENABLE_PWA=1 npm run dev
const withPWA = withPWAInit({
  dest: "public",
  disable:
    process.env.ENABLE_PWA === "1"
      ? false
      : process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig: NextConfig = {
  output: "standalone",
  // Avoid the locked `.next` folder Nextcloud holds open on Windows
  distDir: ".next-local",
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: lanDevOrigins(),
  // next-pwa injects webpack; Next 16 defaults to Turbopack — use `next build --webpack`
  turbopack: {},
  redirects: async () => [
    { source: "/dashboard", destination: "/bluetooth", permanent: false },
    { source: "/projects", destination: "/bluetooth", permanent: false },
    { source: "/settings", destination: "/bluetooth", permanent: false },
    { source: "/login", destination: "/bluetooth", permanent: false },
    { source: "/admin", destination: "/bluetooth", permanent: false },
    { source: "/profile", destination: "/bluetooth", permanent: false },
  ],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default process.env.NODE_ENV === "production" || process.env.ENABLE_PWA === "1"
  ? withPWA(nextConfig)
  : nextConfig;
