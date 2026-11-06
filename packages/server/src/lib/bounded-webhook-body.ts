/**
 * Read an inbound webhook as exact raw bytes with an in-flight memory cap.
 * Never call Request.text()/arrayBuffer() before enforcing the cap: when the
 * client omits Content-Length those methods buffer the entire request.
 */
export class WebhookBodyTooLargeError extends Error {
  constructor() {
    super("Webhook body exceeds limit");
    this.name = "WebhookBodyTooLargeError";
  }
}

export async function readBoundedWebhookBody(
  request: Pick<Request, "body">,
  maxBytes: number,
): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("Invalid webhook body limit");
  }
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let received = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value;
      if (!(chunk instanceof Uint8Array)) throw new TypeError("Invalid webhook body chunk");
      // Test before allocating/copying a chunk or exceeding the bounded sum.
      if (chunk.byteLength > maxBytes - received) {
        try { await reader.cancel("Webhook body limit exceeded"); } catch { /* best-effort */ }
        throw new WebhookBodyTooLargeError();
      }
      received += chunk.byteLength;
      chunks.push(Buffer.from(chunk));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, received);
}
