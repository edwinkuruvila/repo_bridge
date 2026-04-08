#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

prepend_path() {
  if [ -d "$1" ]; then
    PATH="$1${PATH:+:$PATH}"
  fi
}

# Firefox native messaging hosts inherit a much smaller environment than an
# interactive terminal. Restore common developer-tool locations so structured
# command execution can resolve tools such as pnpm, corepack, npm, and rg.
if [ -n "${HOME:-}" ]; then
  prepend_path "$HOME/Library/pnpm"
  prepend_path "$HOME/.local/bin"
fi
prepend_path "/usr/local/bin"
prepend_path "/opt/homebrew/bin"

if command -v node >/dev/null 2>&1; then
  NODE_EXECUTABLE=$(command -v node)
elif [ -x /opt/homebrew/bin/node ]; then
  NODE_EXECUTABLE=/opt/homebrew/bin/node
elif [ -x /usr/local/bin/node ]; then
  NODE_EXECUTABLE=/usr/local/bin/node
else
  echo "Kavrith local host could not find Node.js" >&2
  exit 1
fi

NODE_BIN_DIR=$(dirname -- "$NODE_EXECUTABLE")
prepend_path "$NODE_BIN_DIR"
export PATH

exec "$NODE_EXECUTABLE" "$SCRIPT_DIR/dist/index.js"
