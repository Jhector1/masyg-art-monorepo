"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
// Execute the actual source validation functions with I/O adapters stubbed. No network or database access.
const source = fs.readFileSync(path.join(__dirname, "../../packages/server/src/lib/merchant-cloudinary.ts"), "utf8");
const transpiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const moduleStub = { exports: {} };
const fakeRequire = (id) => {
  if (id === "server-only") return {};
  if (id === "cloudinary") return { v2: {} };
  if (id === "@acme/core/lib/prisma") return { prisma: {} };
  if (id === "@acme/core/lib/tenancy") return { requireMerchantAccess: () => {}, validateTenantId: () => {}, TenantAccessError: class extends Error {} };
  return require(id);
};
new Function("require", "module", "exports", transpiled.outputText)(fakeRequire, moduleStub, moduleStub.exports);
const { detectFileType, validateUpload, parsePublicCloudinaryKey, MAX_PUBLIC_IMAGE_BYTES, MAX_DIGITAL_FILE_BYTES } = moduleStub.exports;

test("accepts known image signatures for previews", () => {
  const png = Buffer.from([137,80,78,71,13,10,26,10,0]);
  const jpeg = Buffer.from([255,216,255,224,0]);
  const webp = Buffer.concat([Buffer.from("RIFF"),Buffer.alloc(4),Buffer.from("WEBP")]);
  for (const [mime,bytes] of [["image/png",png],["image/jpeg",jpeg],["image/webp",webp]]) {
    assert.equal(detectFileType(bytes), mime);
    assert.equal(validateUpload(bytes, "preview"), mime);
  }
});
test("rejects raw, executable, SVG and oversized public previews", () => {
  assert.throws(() => validateUpload(Buffer.from("<svg></svg>"), "preview"));
  assert.throws(() => validateUpload(Buffer.from("GIF89a"), "preview"));
  assert.throws(() => validateUpload(Buffer.from("%PDF-1.7"), "preview"));
  assert.throws(() => validateUpload(Buffer.alloc(MAX_PUBLIC_IMAGE_BYTES+1), "preview"));
  assert.throws(() => validateUpload(Buffer.alloc(0), "preview"));
});
test("private digital files recognize PDF ZIP SVG and enforce max size", () => {
  assert.equal(validateUpload(Buffer.from("%PDF-1.7"), "digital"), "application/pdf");
  assert.equal(validateUpload(Buffer.from([80,75,3,4,0]), "digital"), "application/zip");
  assert.equal(validateUpload(Buffer.from("<?xml version='1.0'?> <svg xmlns='http://www.w3.org/2000/svg'></svg>"), "digital"), "image/svg+xml");
  assert.throws(() => validateUpload(Buffer.alloc(MAX_DIGITAL_FILE_BYTES+1), "digital"));
});
test("public delivery key accepts only platform-generated preview paths", () => {
  const good = "ziledigital/org123/products/product123/preview/01234567-89ab-cdef-0123-456789abcdef";
  assert.equal(parsePublicCloudinaryKey(`cloudinary:image:upload:${good}`), good);
  assert.equal(parsePublicCloudinaryKey("cloudinary:raw:authenticated:"+good), null);
  assert.equal(parsePublicCloudinaryKey("cloudinary:image:upload:../../private"), null);
  assert.equal(parsePublicCloudinaryKey("some-untrusted-id"), null);
});
