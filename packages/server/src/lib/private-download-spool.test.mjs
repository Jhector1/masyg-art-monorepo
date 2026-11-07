import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spoolPrivateDownload, PrivateDownloadSpoolError } from "./private-download-spool.ts";

const bytes = (length) => Uint8Array.from({ length }, (_, i) => i % 251);
const stream = (parts, onCancel = () => {}) => new ReadableStream({
  start(controller) {
    for (const part of parts) controller.enqueue(part);
    // keep open only for cases where caller wants a deliberate cancellation
    if (!onCancel.keepOpen) controller.close();
  },
  cancel() { onCancel(); },
});
const collect = async (body) => {
  const chunks = [];
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks);
};
const temporaryDirs = async () => new Set((await readdir(tmpdir())).filter(x => x.startsWith("ziledigital-private-download-")));

// Tests preserve exact file bytes without requiring a live Cloudinary or database.
test("streams exact binary payload and cleans up private spool at EOF", async () => {
  const before = await temporaryDirs();
  const original = bytes(180_001);
  const result = await spoolPrivateDownload(stream([original.subarray(0, 80_000), original.subarray(80_000)]), null, 200_000);
  assert.equal(result.byteLength, original.length);
  const actual = await collect(result.body);
  assert.deepEqual(actual, Buffer.from(original));
  assert.deepEqual(await temporaryDirs(), before);
});

test("max-size boundary is inclusive", async () => {
  const result = await spoolPrivateDownload(stream([bytes(5), bytes(3)]), "8", 8);
  assert.equal(result.byteLength, 8);
  assert.deepEqual(await collect(result.body), Buffer.concat([Buffer.from(bytes(5)), Buffer.from(bytes(3))]));
});

test("oversize stream is refused before any bytes can reach buyer", async () => {
  const before = await temporaryDirs();
  let canceled = false;
  const onCancel = () => { canceled = true; }; onCancel.keepOpen = true;
  const payload = stream([bytes(6), bytes(6)], onCancel);
  await assert.rejects(() => spoolPrivateDownload(payload, null, 10), PrivateDownloadSpoolError);
  assert.equal(canceled, true);
  assert.deepEqual(await temporaryDirs(), before);
});

test("content-length exceeding limit is refused without reading file", async () => {
  let canceled = false;
  const onCancel = () => { canceled = true; }; onCancel.keepOpen = true;
  await assert.rejects(() => spoolPrivateDownload(stream([], onCancel), "13", 12), PrivateDownloadSpoolError);
  assert.equal(canceled, true);
});

test("invalid content-length is rejected", async () => {
  await assert.rejects(() => spoolPrivateDownload(stream([bytes(2)]), "NaN", 10), PrivateDownloadSpoolError);
});

test("empty source never generates a usable download", async () => {
  const before = await temporaryDirs();
  await assert.rejects(() => spoolPrivateDownload(stream([]), null, 8), PrivateDownloadSpoolError);
  assert.deepEqual(await temporaryDirs(), before);
});

test("upstream failure cleans up temp files", async () => {
  const before = await temporaryDirs();
  const source = new ReadableStream({
    start(controller) { controller.enqueue(bytes(4)); controller.error(new Error("NETWORK_DISCONNECTED")); },
  });
  await assert.rejects(() => spoolPrivateDownload(source, null, 10), /NETWORK_DISCONNECTED/);
  assert.deepEqual(await temporaryDirs(), before);
});

test("client cancellation removes temp files", async () => {
  const before = await temporaryDirs();
  const result = await spoolPrivateDownload(stream([bytes(150_000)]), null, 200_000);
  const reader = result.body.getReader();
  const first = await reader.read();
  assert.equal(first.done, false);
  assert.ok(first.value.byteLength <= 64 * 1024);
  await reader.cancel();
  assert.deepEqual(await temporaryDirs(), before);
});

test("pre-handoff grant denial can dispose spool before streaming", async () => {
  const before = await temporaryDirs();
  const result = await spoolPrivateDownload(stream([bytes(4)]), null, 10);
  await result.dispose();
  assert.deepEqual(await temporaryDirs(), before);
});

// A dead worker's marked spool can be reclaimed without touching a live peer.
// Synthetic owners keep tests independent from process scheduling and Stripe.
const REAPER_PREFIX = "ziledigital-private-download-";
const ORPHAN_AGE_MS = 2 * 60 * 60 * 1000;
const STALE_AT = () => new Date(Date.now() - ORPHAN_AGE_MS);
const FAKE_DEAD_PID = 999999999;
const OWNER_MARKER = ".ziledigital-spool-owner.json";
const makeMarkedDirectory = async ({ pid = FAKE_DEAD_PID, host, stale = true, marker = true, symlinkMarker = false } = {}) => {
  const { mkdtemp, writeFile, utimes, symlink, readlink } = await import("node:fs/promises");
  const { hostname } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), `${REAPER_PREFIX}${pid}-`));
  const markerPath = join(directory, OWNER_MARKER);
  const namespace = process.platform === "linux" ? await readlink("/proc/self/ns/pid") : null;
  if (symlinkMarker) await symlink("/etc/hosts", markerPath);
  else if (marker) await writeFile(markerPath, JSON.stringify({
    version: 1, pid, hostname: host ?? hostname(), pidNamespace: namespace,
    createdAtMs: stale ? Date.now() - ORPHAN_AGE_MS : Date.now(),
  }), { flag: "wx", mode: 0o600 });
  await writeFile(join(directory, "payload"), "private");
  if (stale) await utimes(directory, STALE_AT(), STALE_AT());
  return directory;
};

const exists = async path => {
  const { lstat } = await import("node:fs/promises");
  try { await lstat(path); return true; } catch (e) { if (e.code === "ENOENT") return false; throw e; }
};
const removeTestDirectory = async path => {
  const { rm } = await import("node:fs/promises");
  await rm(path, { recursive: true, force: true });
};

test("orphan sweeper reclaims only marked, old, dead-process spools", async () => {
  const { reapOrphanedPrivateDownloadSpools } = await import("./private-download-spool.ts");
  const dir = await makeMarkedDirectory();
  try {
    const result = await reapOrphanedPrivateDownloadSpools();
    assert.ok(result.removed >= 1);
    assert.equal(await exists(dir), false);
  } finally { await removeTestDirectory(dir); }
});

test("orphan sweeper preserves an old spool owned by this live process", async () => {
  const { reapOrphanedPrivateDownloadSpools } = await import("./private-download-spool.ts");
  const dir = await makeMarkedDirectory({ pid: process.pid });
  try {
    await reapOrphanedPrivateDownloadSpools();
    assert.equal(await exists(dir), true);
  } finally { await removeTestDirectory(dir); }
});

test("orphan sweeper preserves new directories, even if owner is dead", async () => {
  const { reapOrphanedPrivateDownloadSpools } = await import("./private-download-spool.ts");
  const dir = await makeMarkedDirectory({ stale: false });
  try {
    await reapOrphanedPrivateDownloadSpools();
    assert.equal(await exists(dir), true);
  } finally { await removeTestDirectory(dir); }
});

test("orphan sweeper refuses foreign-host, unmarked, and symlink markers", async () => {
  const { reapOrphanedPrivateDownloadSpools } = await import("./private-download-spool.ts");
  const dirs = [
    await makeMarkedDirectory({ host: "another-host.example" }),
    await makeMarkedDirectory({ marker: false }),
    await makeMarkedDirectory({ symlinkMarker: true }),
  ];
  try {
    await reapOrphanedPrivateDownloadSpools();
    for (const dir of dirs) assert.equal(await exists(dir), true);
  } finally { await Promise.all(dirs.map(removeTestDirectory)); }
});

test("orphan sweeper never deletes unmarked legacy spool folders", async () => {
  const { mkdtemp, utimes, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { reapOrphanedPrivateDownloadSpools } = await import("./private-download-spool.ts");
  const dir = await mkdtemp(join(tmpdir(), REAPER_PREFIX));
  try {
    await writeFile(join(dir, "payload"), "not-owned");
    await utimes(dir, STALE_AT(), STALE_AT());
    await reapOrphanedPrivateDownloadSpools();
    assert.equal(await exists(dir), true);
  } finally { await removeTestDirectory(dir); }
});

test("a spool abandoned by a terminated worker is safely reclaimable", async () => {
  const { spawnSync } = await import("node:child_process");
  const { resolve } = await import("node:path");
  const { readdir, readFile, utimes } = await import("node:fs/promises");
  const before = await temporaryDirs();
  const worker = spawnSync(process.execPath, [
    "--experimental-strip-types", "--input-type=module", "-e",
    `import {spoolPrivateDownload} from ${JSON.stringify(new URL("./private-download-spool.ts", import.meta.url).href)};
     await spoolPrivateDownload(new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2,3]));c.close()}}),null,20);
     process.exit(0);`,
  ], { encoding: "utf8", timeout: 10_000 });
  assert.equal(worker.status, 0, worker.stderr);
  const after = await temporaryDirs();
  const created = [...after].filter(name => !before.has(name) && name.startsWith(`${REAPER_PREFIX}${worker.pid}-`));
  assert.equal(created.length, 1);
  const dir = resolve(tmpdir(), created[0]);
  try {
    const path = resolve(dir, OWNER_MARKER);
    const { writeFile } = await import("node:fs/promises");
    const owner = JSON.parse(await readFile(path, "utf8"));
    owner.createdAtMs = Date.now() - ORPHAN_AGE_MS;
    await writeFile(path, JSON.stringify(owner));
    await utimes(dir, STALE_AT(), STALE_AT());
    const { reapOrphanedPrivateDownloadSpools } = await import("./private-download-spool.ts");
    await reapOrphanedPrivateDownloadSpools();
    assert.equal(await exists(dir), false);
  } finally { await removeTestDirectory(dir); }
});
