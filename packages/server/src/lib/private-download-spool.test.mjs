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
