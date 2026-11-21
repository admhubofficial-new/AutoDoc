import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signSessionPayload,
  verifySessionPayload,
  type SessionPayload,
} from "../supabase/functions/autodoc-auth/session.ts";
import { normalizeToken } from "../supabase/functions/autodoc-auth/validation.ts";

const secret = "unit-test-only-secret-at-least-32-characters";
const keyPromise = crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

async function makePayload(now: number): Promise<SessionPayload> {
  return {
    v: 1,
    iat: now,
    exp: now + 12 * 60 * 60,
    nonce: "abcdefghijklmnopqr",
  };
}

test("active Edge Function session helper accepts a valid 12-hour payload", async () => {
  const now = 1_800_000_000;
  const key = await keyPromise;
  const token = await signSessionPayload(await makePayload(now), key);
  assert.deepEqual(await verifySessionPayload(token, key, now + 60, 12 * 60 * 60), await makePayload(now));
});

test("active Edge Function session helper rejects a modified signature", async () => {
  const now = 1_800_000_000;
  const key = await keyPromise;
  const token = await signSessionPayload(await makePayload(now), key);
  const altered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  assert.equal(await verifySessionPayload(altered, key, now + 60, 12 * 60 * 60), null);
});

test("active Edge Function session helper rejects expired and future-issued payloads", async () => {
  const now = 1_800_000_000;
  const key = await keyPromise;
  const expired = await signSessionPayload(await makePayload(now), key);
  assert.equal(await verifySessionPayload(expired, key, now + 12 * 60 * 60 + 1, 12 * 60 * 60), null);

  const future = { ...(await makePayload(now + 120)) };
  const futureToken = await signSessionPayload(future, key);
  assert.equal(await verifySessionPayload(futureToken, key, now, 12 * 60 * 60), null);
});

test("PIN normalization enforces 6 to 128 characters in the active backend", () => {
  assert.equal(normalizeToken("12345"), null);
  assert.equal(normalizeToken("123456"), "123456");
  assert.equal(normalizeToken("  ABCDEF  "), "ABCDEF");
  assert.equal(normalizeToken("x".repeat(129)), null);
  assert.equal(normalizeToken(123456), null);
});
