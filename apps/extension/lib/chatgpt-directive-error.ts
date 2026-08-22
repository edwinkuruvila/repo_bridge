export interface RepoBridgeDirectiveParseError {
  type:
    | "read"
    | "context"
    | "exec"
    | "run"
    | "patch"
    | "git-status"
    | "git-diff"
    | "search";
  message: string;
}

function normalizedDirectiveText(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

export function repobridgeDirectiveParseError(
  text: string,
): RepoBridgeDirectiveParseError | undefined {
  const normalized = normalizedDirectiveText(text);
  const firstLine = normalized.split("\n", 1)[0] ?? "";

  if (/^# repobridge:read(?:\s|$)/.test(firstLine)) {
    return {
      type: "read",
      message:
        'Malformed repobridge:read directive. Accepted forms: (1) one line: "# repobridge:read relative/path startLine endLine"; (2) four lines: "# repobridge:read", then "relative/path", then "startLine", then "endLine". startLine and endLine must be positive integers.',
    };
  }

  if (/^# repobridge:context(?:\s|$)/.test(firstLine)) {
    if (firstLine !== "# repobridge:context") {
      return {
        type: "context",
        message: [
          "Malformed repobridge:context directive.",
          "Put the directive marker on its own line and the JSON payload on the next line.",
          "# repobridge:context",
          '{"searches":["query"],"reads":[]}',
        ].join("\n"),
      };
    }

    const payload = normalized.slice(firstLine.length).trim();
    let value: unknown;
    try {
      value = JSON.parse(payload);
    } catch {
      return {
        type: "context",
        message: [
          "Malformed repobridge:context directive: payload is not valid JSON.",
          "# repobridge:context",
          '{"searches":["query"],"reads":[]}',
        ].join("\n"),
      };
    }

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {
        type: "context",
        message:
          "Malformed repobridge:context directive: JSON payload must be an object.",
      };
    }

    return {
      type: "context",
      message: [
        "Malformed repobridge:context directive: JSON is valid, but it does not match the context schema.",
        'searches: up to 8 strings (or {"query":"..."} / {"q":"..."} objects).',
        'reads: up to 16 path strings or {"path":"...","startLine":1,"endLine":500} objects.',
        "Optional: searchesByName, includeRepositoryMap, maxChars.",
        "At least one search, read, name search, or includeRepositoryMap=true is required.",
      ].join("\n"),
    };
  }

  if (/^# repobridge:exec(?:\s|$)/.test(firstLine)) {
    return {
      type: "exec",
      message: [
        "Malformed repobridge:exec directive.",
        "Use the exact marker followed by a JSON object containing a non-empty executable string and an args string array.",
        "# repobridge:exec",
        '{"executable":"git","args":["status","--short"]}',
      ].join("\n"),
    };
  }

  if (/^# repobridge:run(?:\s|$)/.test(firstLine)) {
    return {
      type: "run",
      message: [
        "Malformed repobridge:run directive.",
        "Put the directive marker on its own line and the shell command on the following line(s).",
        "# repobridge:run",
        "git status --short",
      ].join("\n"),
    };
  }

  if (/^# repobridge:patch(?:\s|$)/.test(firstLine)) {
    return {
      type: "patch",
      message: [
        "Malformed repobridge:patch directive.",
        "Put the directive marker on its own line. The patch body must start with *** Begin Patch and end with *** End Patch.",
        "# repobridge:patch",
        "*** Begin Patch",
        "*** Update File: relative/path",
        "@@",
        "-old",
        "+new",
        "*** End Patch",
      ].join("\n"),
    };
  }

  if (/^# repobridge:git-status(?:\s|$)/.test(firstLine)) {
    return {
      type: "git-status",
      message:
        'Malformed repobridge:git-status directive. Use exactly "# repobridge:git-status" with no payload.',
    };
  }

  if (/^# repobridge:git-diff(?:\s|$)/.test(firstLine)) {
    return {
      type: "git-diff",
      message: [
        "Malformed repobridge:git-diff directive.",
        'Use exactly "# repobridge:git-diff", optionally followed by a second line containing "staged".',
      ].join("\n"),
    };
  }

  if (/^# repobridge:search(?:\s|$)/.test(firstLine)) {
    return {
      type: "search",
      message: [
        "Malformed repobridge:search directive.",
        "Put the directive marker on its own line and provide a non-empty search query on the following line(s).",
        "# repobridge:search",
        "query",
      ].join("\n"),
    };
  }

  return undefined;
}
