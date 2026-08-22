#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
. "$ROOT_DIR/scripts/platform-paths.sh"
INSTALL_DIR=$(repobridge_host_install_dir)
HOST_PATH="$INSTALL_DIR/run-host.sh"

if [ ! -f "$ROOT_DIR/apps/host/dist/index.js" ]; then
  echo "Host is not built. Run: pnpm --filter @repobridge/host build" >&2
  exit 1
fi
if [ ! -f "$ROOT_DIR/packages/protocol/dist/index.js" ]; then
  echo "Protocol is not built. Run: pnpm --filter @repobridge/protocol build" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/dist" "$INSTALL_DIR/node_modules/@repobridge/protocol"
cp -R "$ROOT_DIR/apps/host/dist" "$INSTALL_DIR/dist"
mkdir -p "$INSTALL_DIR/node_modules/@repobridge/protocol"
cp -R "$ROOT_DIR/packages/protocol/dist" "$INSTALL_DIR/node_modules/@repobridge/protocol/dist"
cp "$ROOT_DIR/packages/protocol/package.json" "$INSTALL_DIR/node_modules/@repobridge/protocol/package.json"
cp "$ROOT_DIR/apps/host/package.json" "$INSTALL_DIR/package.json"
cp "$ROOT_DIR/apps/host/run-host.sh" "$HOST_PATH"
chmod +x "$HOST_PATH"

printf '%s\n' "$HOST_PATH"
