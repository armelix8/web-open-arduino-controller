# iPhone / iPad support

Safari on iOS **does not support Web Bluetooth or Web Serial**.  
The PWA still works on iPhone via **Remote (iPhone)** mode over Wi‑Fi.

## How it works

```
iPhone Safari  --WebSocket /bridge-->  Dev proxy / nginx  -->  Bridge
                                                              ^
Desktop Chrome  --Share (host)-------------------------------/
       |
  BLE / Classic BT / USB Serial
       |
    Arduino
```

## Setup

### On your PC (same Wi‑Fi as the iPhone)

1. Start the app: `npm run dev` (starts Next + bridge + `/bridge` proxy)
2. Open Chrome at `http://YOUR_PC_IP:3000`
3. Connect with **BLE**, **Classic BT**, or **USB Serial**
4. Turn on **Share to devices** and copy the **room code**

### On iPhone

1. Open Safari → `http://YOUR_PC_IP:3000` (same Wi‑Fi)
2. Optionally **Share → Add to Home Screen** (install PWA)
3. Go to **Bluetooth**
4. Choose **Remote (iPhone)**
5. Enter the **room code** from the PC
6. Bridge URL should default to `ws://YOUR_PC_IP:3000/bridge` (same port)
7. Tap **Connect Remote**
8. Use Controller / Sensors as usual

## Multi-device / public site

### Same Wi‑Fi (dev)

Many phones can join **one** PC host with the same **room code**.

### Public HTTPS (production)

Host enables **Share**, copy the room code; phone uses Remote + that code (`wss://your-domain/bridge`).

## Voice commands on iPhone

Safari speech API is blocked on `http://LAN-IP`. Use the **keyboard mic** instead:

1. Tap the voice text field (or **Open keyboard**)
2. Tap the **microphone** key on the iPhone keyboard
3. Say e.g. “turn on led” — the app auto-sends when it recognizes the phrase

Websites cannot start keyboard dictation automatically (Apple privacy rule).

## Install as app (iOS)

1. Safari → Share sheet → **Add to Home Screen**
2. Open from the home screen for standalone mode (status bar, no Safari chrome)

## Notes

- iPhone and PC must be on the same LAN (for local `npm run dev`)
- Only the app port (**3000**) needs to be reachable — `/bridge` is proxied
- Dark Reader / other extensions can cause harmless hydration warnings — disable them on the LAN URL if needed
- Voice mic does not work in the installed home-screen PWA on iOS
