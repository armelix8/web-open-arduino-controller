# Deployment Guide

## How public multi-user works

| Piece | Behavior |
|--------|----------|
| Web app (HTTPS) | **No login** — open URL and use |
| Web Bluetooth / Serial / Classic | Runs **in each visitor’s browser** — they pair **their own** Arduino |
| Logs / automation | This browser session only |
| Remote share (phone ↔ PC) | Private **room code** so sessions don’t mix |

Bluetooth never goes through your server — only the website and optional share bridge do.

## Prerequisites

- Docker & Docker Compose
- A **public IP** or domain
- Ports **80** and **443** open
- TLS certificates (required for Web Bluetooth off localhost)

## 1. Configure environment

```bash
cp .env.example .env
```

Set at least:

```env
NEXT_PUBLIC_APP_URL="https://YOUR_PUBLIC_IP_OR_DOMAIN"
BRIDGE_MAX_ROOMS=500
BRIDGE_MAX_REMOTES=20
```

## 2. TLS certificates

```bash
cd deploy/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem -out fullchain.pem \
  -subj "/CN=YOUR_PUBLIC_IP_OR_DOMAIN"
```

For production, use Let’s Encrypt (Certbot) instead of a self-signed cert.  
Browsers may block Web Bluetooth on self-signed certs until the user trusts the certificate.

## 3. Build and run

```bash
docker compose up -d --build
```

Open: `https://YOUR_PUBLIC_IP`

## 4. What each visitor does

1. Open the HTTPS URL (no account needed)
2. On a computer with Chrome/Edge: Bluetooth → connect **their** module
3. Optional: enable **Share to devices**, copy the **room code**, open the same site on a phone → enter room → Connect

## 5. Nginx

`deploy/nginx.conf` terminates TLS, serves the app, and proxies `wss://…/bridge` to the multi-tenant bridge service.

## 6. Security checklist

- [ ] HTTPS only (HTTP redirects)
- [ ] Firewall: only 80/443 public
- [ ] Do not commit `.env` or real certificates

## 7. Local development (not public)

```bash
npm run dev
```

Uses `http://localhost:3000` — bridge is available at `ws://localhost:3000/bridge` via the dev proxy (no Docker required).
