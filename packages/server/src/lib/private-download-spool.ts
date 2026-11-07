import { mkdtemp, open, rm, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A bounded disk spool preserves pre-delivery grant revocation and size checks
 * without holding a complete purchased file in application memory. */
export class PrivateDownloadSpoolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivateDownloadSpoolError";
  }
}

export type PrivateDownloadSpool = {
  body: ReadableStream<Uint8Array>;
  byteLength: number;
  dispose: () => Promise<void>;
};

const READ_CHUNK_BYTES = 64 * 1024;

export async function spoolPrivateDownload(
  source: ReadableStream<Uint8Array>,
  contentLength: string | null,
  maxBytes: number,
): Promise<PrivateDownloadSpool> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("Invalid private download size limit");
  }
  if (contentLength !== null) {
    if (!/^(0|[1-9]\d*)$/.test(contentLength) ||
        !Number.isSafeInteger(Number(contentLength))) {
      await source.cancel().catch(() => {});
      throw new PrivateDownloadSpoolError("Private file exceeds delivery limit");
    }
    if (Number(contentLength) > maxBytes) {
      await source.cancel().catch(() => {});
      throw new PrivateDownloadSpoolError("Private file exceeds delivery limit");
    }
  }

  const reader = source.getReader();
  let dir: string | undefined;
  let writer: FileHandle | undefined;
  let byteLength = 0;

  try {
    // mkdtemp creates a random private directory; the file is created mode 0600.
    dir = await mkdtemp(join(tmpdir(), "ziledigital-private-download-"));
    writer = await open(join(dir, "payload"), "wx", 0o600);
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (byteLength + value.byteLength > maxBytes) {
        throw new PrivateDownloadSpoolError("Private file exceeds delivery limit");
      }
      byteLength += value.byteLength;
      let written = 0;
      while (written < value.byteLength) {
        const result = await writer.write(value, written, value.byteLength - written);
        if (result.bytesWritten <= 0) throw new Error("Private file spool write failed");
        written += result.bytesWritten;
      }
    }
    await writer.close();
    writer = undefined;
    if (byteLength === 0) throw new PrivateDownloadSpoolError("Private file is empty");
  } catch (error) {
    await reader.cancel().catch(() => {});
    await writer?.close().catch(() => {});
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }

  const readyDir = dir!;
  let reading: FileHandle | undefined;
  let cleanup: Promise<void> | undefined;
  const dispose = (): Promise<void> => {
    if (!cleanup) {
      cleanup = (async () => {
        try { await reading?.close(); }
        finally { await rm(readyDir, { recursive: true, force: true }); }
      })();
    }
    return cleanup;
  };

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!reading) reading = await open(join(readyDir, "payload"), "r");
        const buffer = new Uint8Array(READ_CHUNK_BYTES);
        const { bytesRead } = await reading.read(buffer, 0, buffer.length, null);
        if (bytesRead === 0) {
          await dispose();
          controller.close();
        } else {
          controller.enqueue(buffer.subarray(0, bytesRead));
        }
      } catch (error) {
        controller.error(error);
        await dispose().catch(() => {});
      }
    },
    async cancel() { await dispose(); },
  }, { highWaterMark: 0 });

  return { body, byteLength, dispose };
}
