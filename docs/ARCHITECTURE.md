# Architecture

```
┌─────────────────────────────────────────────┐
│                 Next.js PWA                 │
│  Bluetooth · Controller · Sensors · History │
└───────────────────┬─────────────────────────┘
                    │
         ┌──────────▼──────────┐
         │  Connection Store   │
         │  (Zustand + terminal│
         │   + sensors + rules)│
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │   ITransport API    │
         └─────┬─────┬─────┬───┘
               │     │     │
            BLE │ Serial │ Share bridge
               │     │
         HM-10/ESP32  HC-05 / USB-TTL
```

There is no login or database. Connection, logs, and automation live in the browser session. Custom commands persist in `localStorage`.

## Client

- Transport implementations live under `src/lib/transport`
- Protocol parsing in `src/lib/protocol.ts`
- Automation evaluation in `src/lib/automation.ts`
- UI never imports BLE/Serial APIs directly

## Share bridge

`bridge/server.mjs` is a multi-tenant WebSocket relay. A desktop host that holds BLE/Serial can share a room code; phones join as remotes.

## Extending transports

1. Implement `ITransport` / extend `BaseTransport`
2. Register in `createTransport()`
3. Expose the mode in `ConnectionPanel`
