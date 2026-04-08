#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
INSTALL_DIR="$HOME/Library/Application Support/Kavrith/host"
HOST_PATH="$INSTALL_DIR/run-host.sh"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_PATH="$MANIFEST_DIR/com.kavrith.host.json"

if [ "${1:-}" = "--" ]; then
  shift
fi

EXTENSION_ID=${1:-${KAVRITH_CHROME_EXTENSION_ID:-}}
if ! printf '%s' "$EXTENSION_ID" | grep -Eq '^[a-p]{32}$'; then
  echo "Usage: $0 <chrome-extension-id>" >&2
  echo "Find the 32-character ID at chrome://extensions after loading Kavrith unpacked." >&2
  exit 1
fi

HOST_PATH=$("$ROOT_DIR/scripts/install-host-files.sh")
mkdir -p "$MANIFEST_DIR"

sed \
  -e "s|__HOST_PATH__|$HOST_PATH|g" \
  -e "s|__EXTENSION_ID__|$EXTENSION_ID|g" \
  "$ROOT_DIR/scripts/chrome-host-manifest.template.json" > "$MANIFEST_PATH"

echo "Installed Chrome native host manifest:"
echo "$MANIFEST_PATH"
echo "Allowed extension: chrome-extension://$EXTENSION_ID/"
