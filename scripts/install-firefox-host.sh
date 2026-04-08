#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
INSTALL_DIR="$HOME/Library/Application Support/Kavrith/host"
HOST_PATH="$INSTALL_DIR/run-host.sh"
MANIFEST_DIR="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
MANIFEST_PATH="$MANIFEST_DIR/com.kavrith.host.json"

HOST_PATH=$("$ROOT_DIR/scripts/install-host-files.sh")
mkdir -p "$MANIFEST_DIR"

sed "s|__HOST_PATH__|$HOST_PATH|g" "$ROOT_DIR/scripts/firefox-host-manifest.template.json" > "$MANIFEST_PATH"

echo "Installed Firefox native host manifest:"
echo "$MANIFEST_PATH"
