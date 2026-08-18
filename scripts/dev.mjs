import { spawn } from "child_process";
import http from "http";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { lanIPv4 } from "./lan-hosts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Absolute project root with a stable Windows drive letter (avoids C: vs c: webpack dupes). */
const projectRoot = path.resolve(__dirname, "..").replace(/^([a-z]):/, (_, d) => `${d.toUpperCase()}:`);

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * Raw TCP forward of an HTTP Upgrade (WebSocket).
 * Keep the browser Host so Next HMR / App Router match the public origin.
 */
function proxyUpgrade(req, socket, head, targetPort, pathOverride) {
  const target = net.connect(targetPort, "127.0.0.1");

  const fail = () => {
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
    try {
      target.destroy();
    } catch {
      /* ignore */
    }
  };

  target.on("error", fail);
  socket.on("error", fail);

  target.on("connect", () => {
    const reqPath = pathOverride ?? req.url ?? "/";
    let out = `${req.method} ${reqPath} HTTP/1.1\r\n`;
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) out += `${key}: ${v}\r\n`;
      } else {
        out += `${key}: ${value}\r\n`;
      }
    }
    // Tell Next it is behind a proxy without rewriting Host (Host stays as browser sent it)
    if (!req.headers["x-forwarded-host"] && req.headers.host) {
      out += `X-Forwarded-Host: ${req.headers.host}\r\n`;
      out += `X-Forwarded-Proto: http\r\n`;
    }
    out += "\r\n";
    target.write(out);
    if (head?.length) target.write(head);
    target.pipe(socket);
    socket.pipe(target);
  });
}

function proxyHttp(req, res, targetPort) {
  // Preserve Host — rewriting to 127.0.0.1:nextPort breaks App Router / RSC
  const headers = {
    ...req.headers,
    "x-forwarded-host": req.headers.host || `localhost:${publicPort}`,
    "x-forwarded-proto": "http",
    "x-forwarded-port": String(publicPort),
  };
  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
    }
    res.end(`Dev proxy error: ${err.message}`);
  });
  req.pipe(proxyReq);
}

const ips = lanIPv4();
const publicPort = Number(process.env.PORT || 3000);
const bridgePort = Number(process.env.BRIDGE_PORT || 3001);
const nextPort = Number(process.env.NEXT_INTERNAL_PORT || publicPort + 2);

console.log("");
console.log("  Web Open Arduino Controller");
console.log("  ---------------------");
console.log(`  Local:    http://localhost:${publicPort}`);
for (const ip of ips) {
  console.log(`  Network:  http://${ip}:${publicPort}   ← open this on phone Safari`);
  console.log(`  Bridge:   ws://${ip}:${publicPort}/bridge`);
}
if (ips.length === 0) {
  console.log("  Network:  (no LAN IPv4 found — check Wi‑Fi)");
}
console.log(`  Root:     ${projectRoot}`);
console.log("");

if (!(await canListen(publicPort))) {
  console.log(
    `  Already running on port ${publicPort}. Open the URLs above — do not start a second npm run dev.`
  );
  process.exit(0);
}

if (!(await canListen(nextPort))) {
  console.log(
    `  Internal Next port ${nextPort} is busy. Set NEXT_INTERNAL_PORT and retry.`
  );
  process.exit(1);
}

const children = [];
const childEnv = {
  ...process.env,
  // Force consistent casing for module resolution under the junction
  INIT_CWD: projectRoot,
};

if (await canListen(bridgePort)) {
  const bridge = spawn("node", ["bridge/server.mjs"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: { ...childEnv, BRIDGE_PORT: String(bridgePort) },
  });
  children.push(bridge);
  bridge.stdout?.on("data", (d) => process.stdout.write(String(d)));
  bridge.stderr?.on("data", (d) => process.stderr.write(String(d)));
  bridge.on("exit", (code) => {
    if (code) console.error(`Bridge exited with code ${code}`);
  });
} else {
  console.log(`  Bridge already on port ${bridgePort} — reusing it.`);
}

const next = spawn(
  "npx",
  ["next", "dev", "--webpack", "-H", "127.0.0.1", "-p", String(nextPort)],
  { cwd: projectRoot, stdio: "inherit", shell: true, env: childEnv }
);
children.push(next);

const proxy = http.createServer((req, res) => {
  try {
    if (req.url === "/bridge/health") {
      const proxyReq = http.request(
        {
          hostname: "127.0.0.1",
          port: bridgePort,
          path: "/health",
          method: "GET",
          headers: { host: `127.0.0.1:${bridgePort}` },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
          proxyRes.pipe(res);
        }
      );
      proxyReq.on("error", (err) => {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end(`Bridge unreachable: ${err.message}`);
      });
      proxyReq.end();
      return;
    }
    proxyHttp(req, res, nextPort);
  } catch (err) {
    console.error("Proxy request error:", err);
    try {
      res.writeHead(500);
      res.end("Proxy error");
    } catch {
      /* ignore */
    }
  }
});

proxy.on("upgrade", (req, socket, head) => {
  try {
    const url = req.url || "/";
    if (url === "/bridge" || url.startsWith("/bridge?")) {
      proxyUpgrade(req, socket, head, bridgePort, "/");
      return;
    }
    proxyUpgrade(req, socket, head, nextPort);
  } catch (err) {
    console.error("Proxy upgrade error:", err);
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
  }
});

proxy.on("error", (err) => {
  console.error("Dev proxy error:", err);
});

proxy.on("clientError", (err, socket) => {
  console.error("Proxy clientError:", err.message);
  try {
    socket.destroy();
  } catch {
    /* ignore */
  }
});

proxy.listen(publicPort, "0.0.0.0", () => {
  console.log(
    `  Dev proxy on :${publicPort} → Next :${nextPort}, Bridge ws://…/bridge`
  );
  console.log("");
});

function shutdown() {
  try {
    proxy.close();
  } catch {
    /* ignore */
  }
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
next.on("exit", (code) => {
  console.log(`Next exited (${code ?? "null"}) — shutting down proxy`);
  shutdown();
  process.exit(code ?? 0);
});
