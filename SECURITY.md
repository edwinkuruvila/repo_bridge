# Security Policy

## Supported versions

RepoBridge is pre-1.0. Security fixes are made against the latest version on the default branch.

## Reporting a vulnerability

Do not open a public issue for a security vulnerability.

Use **Report a vulnerability** on the repository's **Security** tab. RepoBridge uses GitHub Private Vulnerability Reporting so technical details stay private while the report is investigated and fixed.

If private vulnerability reporting is not available, do not post vulnerability details publicly. Open a non-sensitive issue asking for a private reporting channel.

Security reports will be acknowledged within 14 days.

A useful report includes:

- the affected RepoBridge version or commit
- browser and browser version
- access mode used
- clear reproduction steps
- expected and observed behavior
- security impact
- whether user interaction is required

Do not include unrelated repository contents, credentials, tokens, or other private data.

## Security boundaries

RepoBridge connects a ChatGPT browser session to a local Native Messaging host. The host can read and modify the selected repository and can run local commands.

The boundaries below are intentional parts of the design.

### Repository access

You select a repository through the operating-system folder picker for each ChatGPT conversation.

RepoBridge file reads and patches canonicalize paths before access. They reject absolute-path traversal, parent traversal, and symlink escapes outside the selected repository.

A bypass of these checks is a security issue.

### Ask before changes

In **Ask before changes**, inspection operations can run automatically. File changes, undo operations, and commands require a trusted browser user gesture.

RepoBridge rejects synthetic approval, rejection, undo, repository-selection, and access-mode events.

A way to trigger a protected mutation without a trusted user gesture is a security issue.

### Full access

In **Full access**, valid RepoBridge mutation directives rendered in ChatGPT assistant messages can run without confirmation.

This mode trusts the rendered assistant content. If another extension, injected page code, or a compromised page can alter that content, it may be able to cause local mutations while Full access is enabled.

That behavior is part of the Full access trust model. A bypass that affects **Ask before changes** is a security issue.

### Command execution

`command.exec` launches an executable with a literal argument array. It does not invoke a shell.

`command.run` intentionally executes shell command text.

Both start in the selected repository, but neither is an operating-system sandbox. Commands run with the permissions of the local user and may access files or processes outside the selected repository.

A command doing this after explicit approval, or under Full access, is expected behavior. A repository file API escaping its selected root is not.

### Native Messaging

The native host is restricted through the browser native-host allow list.

Firefox currently retains the legacy extension ID `kavrith@localhost` for compatibility. Chrome installation writes an `allowed_origins` entry for the exact extension ID supplied during host registration.

The host validates request framing, request IDs, protocol version, method names, and method-specific input before dispatch.

A way for an unauthorized browser extension or web page to invoke the host is a security issue.

### Repository content and prompt injection

Treat repository contents and command output as untrusted input.

A repository can contain text intended to influence the language model into proposing unsafe operations. When working with untrusted code, use **Ask before changes** and review mutations before approving them.

RepoBridge does not execute directive-looking text merely because it appears in a repository file or command output. Execution requires a valid directive to appear later as an assistant directive and pass the configured access policy.

### Local state

RepoBridge stores local task metadata and patch checkpoints. Checkpoints may contain previous file contents needed for undo.

This state stays local and uses restrictive filesystem permissions where supported.

## What to report

Report issues that can cause any of the following without the access required by RepoBridge's documented trust model:

- reading or modifying files outside the selected repository through repository file APIs
- executing a protected mutation without a trusted approval gesture in **Ask before changes**
- invoking the native host from an unauthorized origin or extension
- bypassing protocol or request validation in a way that reaches a privileged operation
- replaying a completed or rejected mutation so that it executes again
- exposing local repository data to an unintended remote party

## Expected behavior

The following are not vulnerabilities by themselves:

- an approved command accessing data outside the repository
- a command under **Full access** using the local user's normal permissions
- malicious repository text influencing the language model before the user approves a mutation
- another local process running as the same OS user reading files that the OS already allows it to read
- denial of service that requires control of the local user account
