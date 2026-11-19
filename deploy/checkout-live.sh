#!/usr/bin/env bash
# Clone or fast-forward /opt/openconnect/src to origin/live. Does not rebuild.
set -euo pipefail
REPO_URL="${OPENCONNECT_REPO_URL:-https://github.com/armelix8/web-open-arduino-controller.git}"
SRC="${OPENCONNECT_SRC:-/opt/openconnect/src}"
LIVE_BRANCH="${OPENCONNECT_LIVE_BRANCH:-live}"

sudo mkdir -p "$SRC"
sudo chown -R "$(id -un):$(id -gn)" "$SRC"

if [[ ! -d "$SRC/.git" ]]; then
  git clone --branch "$LIVE_BRANCH" "$REPO_URL" "$SRC"
else
  cd "$SRC"
  git fetch origin "$LIVE_BRANCH"
  git checkout "$LIVE_BRANCH"
  git reset --hard "origin/$LIVE_BRANCH"
fi

cd "$SRC"
SHA="$(git rev-parse HEAD)"
echo "$SHA" | sudo tee /opt/openconnect/DEPLOYED_SHA >/dev/null
sudo chown openconnect:openconnect /opt/openconnect/DEPLOYED_SHA 2>/dev/null || true
echo "Source at $SRC is $LIVE_BRANCH @ $(git rev-parse --short HEAD)"
echo "Running services are unchanged. Use deploy/sync-from-live.sh to rebuild."
