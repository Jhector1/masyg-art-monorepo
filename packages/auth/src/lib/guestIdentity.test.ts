import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { hashGuestCartToken } from "./guestIdentity";

test("hashes opaque cart token", () => {
  const raw = "b6f87ac9-9a40-44a2-8607-54e00df64300";
  assert.equal(hashGuestCartToken(raw), createHash("sha256").update(raw).digest("hex"));
  assert.equal(hashGuestCartToken(raw).includes(raw), false);
});

test("rejects weak or malformed cart tokens", () => {
  assert.throws(() => hashGuestCartToken("guest123"));
  assert.throws(() => hashGuestCartToken("a".repeat(25) + "/"));
});
