import { lstat, mkdtemp, open, readFile, readdir, readlink, rm, writeFile, type FileHandle } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
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
const SPOOL_PREFIX = "ziledigital-private-download-";
const SPOOL_OWNER_FILE = ".ziledigital-spool-owner.json";
// Never reclaim based on age alone: a legitimate download can outlive this grace.
const ORPHAN_GRACE_MS = 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
const MAX_CANDIDATES_PER_SWEEP = 128;
const MAX_REMOVALS_PER_SWEEP = 32;
const OWNED_DIR = /^ziledigital-private-download-([1-9]\d{0,9})-([A-Za-z0-9]{6})$/;

type OwnerMarker = { version: 1; pid: number; hostname: string; pidNamespace: string | null; createdAtMs: number };

async function localPidNamespace(): Promise<string | null> {
  if (process.platform !== "linux") return null;
  try { return await readlink("/proc/self/ns/pid"); }
  catch { return null; }
}

/** An unknown or inaccessible process is treated as alive (fail closed).
 * Only ESRCH unequivocally means a local PID is no longer running. */
function ownerIsDefinitelyGone(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}

/** Reap only old, marker-authenticated, same-host spools of dead processes.
 * Does not touch legacy unmarked directories, other hosts, or live downloads.
 * Bounded and callable independently from a privileged maintenance command.
 * Also runs opportunistically with the next download; no timer/daemon needed. */
export async function reapOrphanedPrivateDownloadSpools(): Promise<{
  examined: number;
  removed: number;
  errors: number;
}> {
  const root = tmpdir();
  const localHost = hostname();
  const pidNamespace = await localPidNamespace();
  const now = Date.now();
  const result = { examined: 0, removed: 0, errors: 0 };
  // Without a Linux PID namespace identifier, process.kill cannot prove
  // another container's PID is gone. Never sweep in that ambiguous case.
  if (process.platform === "linux" && !pidNamespace) return result;
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const match = OWNED_DIR.exec(entry.name);
    if (!match || !entry.isDirectory() || entry.isSymbolicLink()) continue;
    if (++result.examined > MAX_CANDIDATES_PER_SWEEP || result.removed >= MAX_REMOVALS_PER_SWEEP) break;
    const pid = Number(match[1]);
    if (!Number.isSafeInteger(pid) || pid === process.pid) continue;
    const directory = join(root, entry.name);
    try {
      const info = await lstat(directory);
      if (!info.isDirectory() || now - info.mtimeMs < ORPHAN_GRACE_MS) continue;
      const markerPath = join(directory, SPOOL_OWNER_FILE);
      const markerStat = await lstat(markerPath);
      if (!markerStat.isFile() || markerStat.isSymbolicLink()) continue;
      const raw = await readFile(markerPath, "utf8");
      if (raw.length > 512) continue;
      let owner: OwnerMarker;
      try { owner = JSON.parse(raw) as OwnerMarker; } catch { continue; }
      if (owner.version !== 1 || owner.pid !== pid || owner.hostname !== localHost ||
          owner.pidNamespace !== pidNamespace ||
          !Number.isSafeInteger(owner.createdAtMs) || owner.createdAtMs <= 0 ||
          now - owner.createdAtMs < ORPHAN_GRACE_MS) continue;
      if (!ownerIsDefinitelyGone(pid)) continue;
      // Re-verify identity immediately before removing. Unknown states are skipped.
      const again = await lstat(directory);
      const againMarker = await lstat(markerPath);
      if (!again.isDirectory() || !againMarker.isFile() || againMarker.isSymbolicLink() ||
          again.ino !== info.ino || again.dev !== info.dev ||
          now - again.mtimeMs < ORPHAN_GRACE_MS) continue;
      if ((await readFile(markerPath, "utf8")) !== raw) continue;
      await rm(directory, { recursive: true, force: true, maxRetries: 1, retryDelay: 100 });
      result.removed++;
    } catch (error) {
      // ENOENT may simply mean that another worker removed it first.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") result.errors++;
    }
  }
  return result;
}

let lastSweepAt = 0;
let sweepInFlight: Promise<void> | undefined;
function sweepOccasionally(): void {
  const now = Date.now();
  if (sweepInFlight || now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  sweepInFlight = reapOrphanedPrivateDownloadSpools()
    .then(() => {})
    .catch(() => {}) // Temp cleanup must never deny a legitimate download.
    .finally(() => { sweepInFlight = undefined; });
}

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

  sweepOccasionally(); // Nonblocking, on-demand cleanup; no timer or worker.
  const reader = source.getReader();
  let dir: string | undefined;
  let writer: FileHandle | undefined;
  let byteLength = 0;

  try {
    // mkdtemp creates mode 0700; payload and owner metadata use mode 0600.
    dir = await mkdtemp(join(tmpdir(), `${SPOOL_PREFIX}${process.pid}-`));
    const marker: OwnerMarker = { version: 1, pid: process.pid, hostname: hostname(),
      pidNamespace: await localPidNamespace(), createdAtMs: Date.now() };
    await writeFile(join(dir, SPOOL_OWNER_FILE), JSON.stringify(marker), { flag: "wx", mode: 0o600 });
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
