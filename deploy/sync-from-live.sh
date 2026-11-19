#!/usr/bin/env bash
# Update this host from origin/live and restart Open Connect.
# Intended to run on the production VM (hostname openconnect), as giih with sudo.
set -euo pipefail

REPO_URL="${OPENCONNECT_REPO_URL:-https://github.com/armelix8/web-open-arduino-controller.git}"
SRC="${OPENCONNECT_SRC:-/opt/openconnect/src}"
APP="${OPENCONNECT_APP:-/opt/openconnect/app}"
BRIDGE="${OPENCONNECT_BRIDGE:-/opt/openconnect/bridge}"
LIVE_BRANCH="${OPENCONNECT_LIVE_BRANCH:-live}"

if [[ "$(hostname -s)" != "openconnect" && "${OPENCONNECT_ALLOW_OFFHOST:-}" != "1" ]]; then
  echo "Refusing to deploy: hostname is '$(hostname -s)', expected 'openconnect'." >&2
  echo "Set OPENCONNECT_ALLOW_OFFHOST=1 to override." >&2
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as giih (the script uses sudo where needed), not as root." >&2
  exit 1
fi

sudo mkdir -p "$SRC" "$APP" "$BRIDGE" /opt/openconnect/logs
sudo chown -R "$(id -un):$(id -gn)" "$SRC"

if [[ ! -d "$SRC/.git" ]]; then
  git clone --branch "$LIVE_BRANCH" "$REPO_URL" "$SRC"
fi

cd "$SRC"
git remote set-url origin "$REPO_URL"
git fetch origin "$LIVE_BRANCH"
git checkout "$LIVE_BRANCH"
git reset --hard "origin/$LIVE_BRANCH"
SHA="$(git rev-parse HEAD)"
SHORT="$(git rev-parse --short HEAD)"
echo "Checked out $LIVE_BRANCH @ $SHORT"

export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://openconnect.ur.ac.rw}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"

npm ci
npm run build

STAGE="$(mktemp -d /tmp/openconnect-release.XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT
cp -a .next-local/standalone/. "$STAGE/"
mkdir -p "$STAGE/.next-local"
cp -a .next-local/static "$STAGE/.next-local/static"
cp -a public "$STAGE/public"
cat >"$STAGE/.env" <<EOF
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=Open Connect
NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
PORT=3000
HOSTNAME=127.0.0.1
BRIDGE_PORT=3001
BRIDGE_MAX_REMOTES=20
BRIDGE_MAX_ROOMS=500
EOF

sudo rm -rf "$APP"
sudo mkdir -p "$APP"
sudo cp -a "$STAGE/." "$APP/"
sudo mkdir -p "$BRIDGE"
sudo cp -a "$SRC/bridge/server.mjs" "$BRIDGE/server.mjs"
if [[ ! -d "$BRIDGE/node_modules/ws" ]]; then
  sudo -u openconnect -H npm init -y --prefix "$BRIDGE" >/dev/null
  sudo -u openconnect -H npm install ws@8.21.3 --omit=dev --prefix "$BRIDGE"
fi
printf '%s\n' "$SHA" | sudo tee /opt/openconnect/DEPLOYED_SHA >/dev/null
sudo chown -R openconnect:openconnect /opt/openconnect/app /opt/openconnect/bridge /opt/openconnect/DEPLOYED_SHA
sudo systemctl restart openconnect-app openconnect-bridge
sudo systemctl is-active openconnect-app openconnect-bridge nginx
echo "Live host now running $LIVE_BRANCH @ $SHORT"
