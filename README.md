# Kavrith

Kavrith lets ChatGPT work with a local code repository from the ChatGPT web app.

Instead of copying files and terminal output back and forth, Kavrith can read and search code, apply patches, run commands, inspect Git state, and send results back to the conversation. You choose the repository for each chat and decide whether changes need approval.

Kavrith currently supports macOS with Firefox and Google Chrome.

## What Kavrith does

- Searches repository contents and reads bounded file ranges.
- Combines several searches and reads into one context request.
- Applies repository-scoped patches and can undo Kavrith patches.
- Runs executables with literal arguments.
- Runs shell commands when shell behavior is required.
- Inspects Git status and staged or unstaged diffs.
- Sends operation results back to ChatGPT automatically.

## Access modes

**Ask before changes** is the default. Inspection operations can run automatically. File edits, undo operations, and commands wait for your approval.

**Full access** lets valid Kavrith directives in ChatGPT assistant messages edit files and run commands without confirmation.

> [!WARNING]
> Commands are not sandboxed to the selected repository. They start there, but they run with your normal user permissions. Use Full access only in chats you trust.

Repository read and patch operations use separate path-containment checks and reject traversal and symlink escapes.

Read [SECURITY.md](SECURITY.md) for the full trust model and vulnerability-reporting policy.

## Requirements

- macOS
- Firefox or Google Chrome
- Node.js 22 or newer
- pnpm 10
- ripgrep

Install the command-line dependencies with Homebrew:

```sh
brew install node pnpm ripgrep
```

If Node.js is already installed, use Corepack for pnpm:

```sh
corepack enable
corepack prepare pnpm@10.14.0 --activate
```

## Build

```sh
pnpm install
pnpm build:browsers
pnpm test
```

## Firefox

Build the extension and install the native host:

```sh
pnpm build:firefox
pnpm install:host:firefox
```

Then:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `apps/extension/.output/firefox-mv2/manifest.json`.
4. Restart Firefox.
5. Open ChatGPT.
6. Click **Kavrith** in the composer.
7. Choose a repository and an access mode.

The host is installed at:

```text
macOS: ~/Library/Application Support/Kavrith/host
Linux: $XDG_DATA_HOME/kavrith/host (default: ~/.local/share/kavrith/host)
```

Firefox reads its Native Messaging manifest from:

```text
macOS: ~/Library/Application Support/Mozilla/NativeMessagingHosts/com.kavrith.host.json
Linux: ~/.mozilla/native-messaging-hosts/com.kavrith.host.json
```

## Chrome

Build the extension:

```sh
pnpm build:chrome
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `apps/extension/.output/chrome-mv3`.
5. Copy the extension ID shown by Chrome.
6. Register the native host for that ID:

   ```sh
   pnpm install:host:chrome -- <extension-id>
   ```

7. Restart Chrome.
8. Open ChatGPT.
9. Click **Kavrith** in the composer.
10. Choose a repository and an access mode.

Chrome reads its Native Messaging manifest from:

```text
macOS: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.kavrith.host.json
Linux: $XDG_CONFIG_HOME/google-chrome/NativeMessagingHosts/com.kavrith.host.json (default: ~/.config/google-chrome/NativeMessagingHosts/com.kavrith.host.json)
```

The installer restricts the host to the supplied extension ID through `allowed_origins`.

## How it works

Kavrith has three parts:

- `apps/extension` — integrates Kavrith with ChatGPT
- `apps/host` — performs local repository operations through Native Messaging
- `packages/protocol` — defines the extension/host protocol

The extension detects Kavrith directives in assistant responses and forwards validated requests to the local host. The host runs the operation against the repository selected for that conversation and returns a structured result.

## Operations

| Operation | Purpose |
| --- | --- |
| Context | Combine searches, reads, name searches, and an optional repository map |
| Search | Search repository text |
| Read | Read a bounded range from a file |
| Patch | Apply repository-scoped file changes |
| Exec | Run an executable with literal arguments |
| Run | Run shell command text |
| Git status | Inspect repository status |
| Git diff | Inspect staged or unstaged changes |
| Undo | Restore a Kavrith patch checkpoint |

Kavrith directives are executable protocol messages. ChatGPT generates them as it works on the repository selected for the conversation.

## Troubleshooting

### Firefox cannot find the native host

Run `pnpm install:host:firefox`, confirm that the Firefox Native Messaging manifest exists, then restart Firefox.

### Chrome cannot connect to the native host

Check the extension ID at `chrome://extensions`, reinstall the host with that exact ID, then restart Chrome:

```sh
pnpm install:host:chrome -- <extension-id>
```

### The host exits immediately

Run `pnpm build`, then check the extension or service-worker console and the host stderr output.

Native Messaging uses stdout for protocol frames, so diagnostics must go to stderr.

### Repository selection does not open

Confirm that the native host is installed and reachable from the extension, then try again.

## Status

Kavrith is pre-1.0 software. The protocol and installation flow may change before a stable release.

## License

Kavrith is licensed under the [MIT License](LICENSE).
