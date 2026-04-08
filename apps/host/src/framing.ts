const HEADER_SIZE = 4;
export const MAX_MESSAGE_SIZE = 1024 * 1024;

export function encodeMessage(value: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  const header = Buffer.allocUnsafe(HEADER_SIZE);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

export class MessageDecoder {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): unknown[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: unknown[] = [];

    while (this.buffer.length >= HEADER_SIZE) {
      const length = this.buffer.readUInt32LE(0);
      if (length > MAX_MESSAGE_SIZE) {
        throw new Error(`Native message exceeds ${MAX_MESSAGE_SIZE} bytes`);
      }
      if (this.buffer.length < HEADER_SIZE + length) break;

      const payload = this.buffer.subarray(HEADER_SIZE, HEADER_SIZE + length);
      this.buffer = this.buffer.subarray(HEADER_SIZE + length);
      try {
        messages.push(JSON.parse(payload.toString("utf8")) as unknown);
      } catch {
        // Preserve framing synchronization and let the handler return a structured error.
        messages.push(null);
      }
    }

    return messages;
  }
}
