#!/usr/bin/env node
/**
 * Multi-tenant LAN/public bridge.
 * Each share session is a ROOM so many users can host their own Arduino
 * without mixing traffic. Remotes join with the same room code.
 *
 * Usage: npm run bridge   (also started by npm run dev)
 */

import { createServer } from "http";
import WebSocket, { WebSocketServer } from "ws";

const PORT = Number(process.env.BRIDGE_PORT || 3001);
const MAX_REMOTES = Number(process.env.BRIDGE_MAX_REMOTES || 20);
const MAX_ROOMS = Number(process.env.BRIDGE_MAX_ROOMS || 500);

/**
 * @typedef {{ host: WebSocket | null, remotes: Set<WebSocket>, lastStatus: { connected: boolean, deviceName?: string, deviceId?: string } }} Room
 */

/** @type {Map<string, Room>} */
const rooms = new Map();
/** @type {WeakMap<WebSocket, { role: string, roomId: string, name?: string }>} */
const meta = new WeakMap();

function normalizeRoom(id) {
  const raw = String(id || "LOBBY")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return raw || "LOBBY";
}

function getRoom(id) {
  const roomId = normalizeRoom(id);
  let room = rooms.get(roomId);
  if (!room) {
    if (rooms.size >= MAX_ROOMS) {
      return { roomId, room: null, created: false };
    }
    room = {
      host: null,
      remotes: new Set(),
      lastStatus: { connected: false },
    };
    rooms.set(roomId, room);
    return { roomId, room, created: true };
  }
  return { roomId, room, created: false };
}

function pruneRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const hostAlive = room.host && room.host.readyState === WebSocket.OPEN;
  if (!hostAlive && room.remotes.size === 0) {
    rooms.delete(roomId);
  }
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRemotes(room, payload) {
  for (const r of room.remotes) send(r, payload);
}

function peersPayload(roomId, room) {
  return {
    type: "peers",
    room: roomId,
    remotes: room.remotes.size,
    hostOnline: !!(room.host && room.host.readyState === WebSocket.OPEN),
    deviceName: room.lastStatus.deviceName,
  };
}

function broadcastPeers(roomId, room) {
  const payload = peersPayload(roomId, room);
  if (room.host) send(room.host, payload);
  broadcastRemotes(room, payload);
}

const httpServer = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        rooms: rooms.size,
        maxRooms: MAX_ROOMS,
        maxRemotesPerRoom: MAX_REMOTES,
      })
    );
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(
    `Web Open Arduino Controller multi-tenant bridge\nRooms: ${rooms.size}/${MAX_ROOMS}\n`
  );
});

const wss = new WebSocketServer({ noServer: true });

function onListenError(err) {
  if (err && err.code === "EADDRINUSE") {
    console.log(`Bridge already running on port ${PORT} — reusing it.`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
}

httpServer.on("error", onListenError);
wss.on("error", onListenError);

httpServer.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws) => {
  meta.set(ws, { role: "remote", roomId: "LOBBY" });

  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(String(buf));
    } catch {
      return;
    }

    if (msg.type === "hello") {
      const role = msg.role === "host" ? "host" : "remote";
      const name = typeof msg.deviceName === "string" ? msg.deviceName : undefined;
      const { roomId, room, created } = getRoom(msg.room);
      if (!room) {
        send(ws, {
          type: "error",
          message: "Bridge is at capacity. Try again later.",
        });
        ws.close();
        return;
      }

      meta.set(ws, { role, roomId, name });

      if (role === "host") {
        if (room.host && room.host !== ws) {
          try {
            send(room.host, {
              type: "error",
              message: "Another host took over this room",
            });
            room.host.close();
          } catch {
            /* ignore */
          }
        }
        room.host = ws;
        room.remotes.delete(ws);
        console.log(
          `[bridge] Host in room ${roomId} (${name || "device"})${created ? " [new]" : ""}`
        );
        send(ws, {
          type: "welcome",
          room: roomId,
          hostOnline: true,
          remotes: room.remotes.size,
          multiDevice: true,
          maxRemotes: MAX_REMOTES,
        });
        room.lastStatus = {
          connected: true,
          deviceName: name || room.lastStatus.deviceName || "Arduino",
          deviceId: room.lastStatus.deviceId,
        };
        broadcastRemotes(room, {
          type: "status",
          connected: true,
          deviceName: room.lastStatus.deviceName,
          deviceId: room.lastStatus.deviceId,
        });
        broadcastPeers(roomId, room);
        return;
      }

      if (room.remotes.size >= MAX_REMOTES && !room.remotes.has(ws)) {
        send(ws, {
          type: "error",
          message: `Room ${roomId} is full (${MAX_REMOTES} remotes).`,
        });
        ws.close();
        return;
      }

      room.remotes.add(ws);
      console.log(
        `[bridge] Remote in room ${roomId} (total ${room.remotes.size})`
      );
      send(ws, {
        type: "welcome",
        room: roomId,
        hostOnline: !!(room.host && room.host.readyState === WebSocket.OPEN),
        remotes: room.remotes.size,
        multiDevice: true,
        maxRemotes: MAX_REMOTES,
      });
      if (room.lastStatus.connected) {
        send(ws, {
          type: "status",
          connected: true,
          deviceName: room.lastStatus.deviceName || "Arduino",
          deviceId: room.lastStatus.deviceId,
        });
      }
      broadcastPeers(roomId, room);
      return;
    }

    const info = meta.get(ws);
    if (!info) return;
    const room = rooms.get(info.roomId);
    if (!room) return;

    if (msg.type === "tx") {
      if (room.host && room.host.readyState === WebSocket.OPEN) {
        send(room.host, { ...msg, from: info.name || "remote" });
      } else {
        send(ws, { type: "error", message: "No host is sharing in this room" });
      }
      return;
    }

    if (msg.type === "rx" || msg.type === "status") {
      if (msg.type === "status") {
        room.lastStatus = {
          connected: !!msg.connected,
          deviceName: msg.deviceName,
          deviceId: msg.deviceId,
        };
      }
      broadcastRemotes(room, msg);
      return;
    }

    if (msg.type === "ping") {
      send(ws, {
        type: "pong",
        room: info.roomId,
        remotes: room.remotes.size,
      });
    }
  });

  ws.on("close", () => {
    const info = meta.get(ws);
    if (!info) return;
    const room = rooms.get(info.roomId);
    if (!room) return;

    if (info.role === "host" && room.host === ws) {
      room.host = null;
      room.lastStatus = {
        connected: false,
        deviceName: room.lastStatus.deviceName,
      };
      console.log(`[bridge] Host left room ${info.roomId}`);
      broadcastRemotes(room, { type: "host_offline" });
      broadcastRemotes(room, { type: "status", connected: false });
      broadcastPeers(info.roomId, room);
    }

    if (info.role === "remote") {
      room.remotes.delete(ws);
      console.log(
        `[bridge] Remote left room ${info.roomId} (total ${room.remotes.size})`
      );
      broadcastPeers(info.roomId, room);
    }

    pruneRoom(info.roomId);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Web Open Arduino Controller bridge listening on ws://0.0.0.0:${PORT}`);
  console.log(
    `Multi-tenant rooms (max ${MAX_ROOMS}), ${MAX_REMOTES} remotes/room`
  );
  console.log("Public HTTPS: proxy /bridge → this port (see deploy/nginx.conf)");
});
