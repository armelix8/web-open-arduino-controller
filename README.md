# Web Open Arduino Controller

Progressive Web App for controlling Arduino over **BLE**, **Classic Bluetooth**, **USB Serial**, and a **Wi‑Fi remote bridge**.

## Stack

- Next.js 16 · React 19 · TypeScript · Tailwind CSS 4
- Zustand · Framer Motion · PWA
- Docker · Nginx (HTTPS) · WebSocket share bridge

## Transport architecture

| Mode | Use for |
|------|---------|
| **BLE** | HM-10, ESP32 BLE UART (NUS) |
| **Classic BT** | HC-05 / HC-06 after pairing in the OS |
| **USB Serial** | USB-TTL adapters |
| **Remote share** | Phone joins a desktop host via room code |

UI talks to `ITransport` only — new transports plug in without UI changes.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000

## Browser support

- Chrome / Edge / Android Chrome (HTTPS or localhost) — BLE + Web Serial
- **iPhone / iPad Safari** — use [Remote bridge mode](./docs/IPHONE.md)
- Safari / Firefox desktop: USB Serial or Remote share where available

## Features

- Scan & connect, disconnect, auto-reconnect, live status
- Serial terminal with timestamps, auto-scroll, clear, export
- Controller widgets: buttons, switches, PWM, joystick, RGB, servo, keypad, D-pad, voice
- Sensor cards and live sparklines
- Automation IF/THEN rules + daily schedules (this session)
- Arduino code generator + sample sketches in `/arduino`

## Scripts

```bash
npm run dev          # Next + bridge + /bridge proxy
npm run build        # production build
npm run start        # start production server
npm test             # unit tests
```

## Documentation

- [Deployment guide](./docs/DEPLOYMENT.md)
- [iPhone / remote](./docs/IPHONE.md)
- [Protocol reference](./docs/PROTOCOL.md)
- [Architecture](./docs/ARCHITECTURE.md)

## License

MIT
