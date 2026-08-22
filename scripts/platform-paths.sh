#!/bin/sh

repobridge_host_install_dir() {
  case "$(uname -s)" in
    Darwin) printf '%s\n' "$HOME/Library/Application Support/RepoBridge/host" ;;
    Linux) printf '%s\n' "${XDG_DATA_HOME:-$HOME/.local/share}/repobridge/host" ;;
    *) echo "Unsupported platform: $(uname -s)" >&2; return 1 ;;
  esac
}

repobridge_firefox_manifest_dir() {
  case "$(uname -s)" in
    Darwin) printf '%s\n' "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts" ;;
    Linux) printf '%s\n' "$HOME/.mozilla/native-messaging-hosts" ;;
    *) echo "Unsupported platform: $(uname -s)" >&2; return 1 ;;
  esac
}

repobridge_chrome_manifest_dir() {
  case "$(uname -s)" in
    Darwin) printf '%s\n' "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" ;;
    Linux) printf '%s\n' "${XDG_CONFIG_HOME:-$HOME/.config}/google-chrome/NativeMessagingHosts" ;;
    *) echo "Unsupported platform: $(uname -s)" >&2; return 1 ;;
  esac
}
