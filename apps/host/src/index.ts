#!/usr/bin/env node
import { MessageDecoder, encodeMessage } from "./framing.js";
import { handleRequest } from "./handler.js";

const decoder = new MessageDecoder();
let processing = Promise.resolve();

process.stdin.on("data", (chunk: Buffer) => {
  try {
    for (const request of decoder.push(chunk)) {
      processing = processing
        .then(async () => {
          try {
            process.stdout.write(encodeMessage(await handleRequest(request)));
          } catch (cause) {
            const message =
              cause instanceof Error ? cause.message : String(cause);
            const requestId =
              typeof request === "object" && request !== null
                ? (request as { id?: unknown }).id
                : undefined;
            const id = typeof requestId === "string" ? requestId : "unknown";
            console.error(`Kavrith local host handler error: ${message}`);
            process.stdout.write(
              encodeMessage({
                version: 1,
                id,
                ok: false,
                error: {
                  code: "INTERNAL_ERROR",
                  message: "Native host failed to process the request",
                },
              }),
            );
          }
        })
        .catch((cause: unknown) => {
          const message =
            cause instanceof Error ? cause.message : String(cause);
          console.error(`Kavrith local host handler error: ${message}`);
        });
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(`Kavrith local host input error: ${message}`);
    process.stdout.write(
      encodeMessage({
        version: 1,
        id: "unknown",
        ok: false,
        error: { code: "INVALID_REQUEST", message },
      }),
    );
  }
});

process.stdin.on("error", (cause) => {
  console.error(`Kavrith local host stdin error: ${cause.message}`);
});
