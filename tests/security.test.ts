import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createThrottleIdentityToken,
  signSessionPayload,
  verifySessionPayload,
  verifyThrottleIdentityToken,
  type SessionPayload,
} from "../supabase/functions/autodoc-auth/session.ts";
import { normalizeToken } from "../supabase/functions/autodoc-auth/validation.ts";
import { readFileSync } from "node:fs";

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
  const separator = token.indexOf(".");
  const firstSignatureChar = token[separator + 1];
  const altered = token.slice(0, separator + 1) + (firstSignatureChar === "A" ? "B" : "A") + token.slice(separator + 2);
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

const historyDeletionMigration = readFileSync(
  new URL("../supabase/migrations/20261121185410_delete_distribution_history.sql", import.meta.url),
  "utf8",
);

test("history deletion migration uses valid dollar quoting for its menu-item trigger", () => {
  const start = historyDeletionMigration.indexOf(
    "CREATE OR REPLACE FUNCTION public.prevent_distribution_menu_item_change_after_documents()",
  );
  const end = historyDeletionMigration.indexOf(
    "REVOKE ALL ON FUNCTION public.prevent_distribution_menu_item_change_after_documents()",
    start,
  );
  assert.ok(start >= 0 && end > start);
  const definition = historyDeletionMigration.slice(start, end);
  const newline = String.fromCharCode(10);
  assert.ok(definition.includes("AS $$" + newline + "DECLARE"));
  assert.ok(definition.includes("END;" + newline + "$$;"));
  assert.ok(!definition.includes("AS $" + newline + "DECLARE"));
});

test("PIN normalization enforces 6 to 128 characters in the active backend", () => {
  assert.equal(normalizeToken("12345"), null);
  assert.equal(normalizeToken("123456"), "123456");
  assert.equal(normalizeToken("  ABCDEF  "), "ABCDEF");
  assert.equal(normalizeToken("x".repeat(129)), null);
  assert.equal(normalizeToken(123456), null);
});


test("browser throttle identity cookies are signed, distinct, and expire after their configured lifetime", async () => {
  const now = 1_800_000_000;
  const key = await keyPromise;
  const first = await createThrottleIdentityToken(key, now);
  const second = await createThrottleIdentityToken(key, now);
  assert.notEqual(first.identity, second.identity);
  assert.equal(await verifyThrottleIdentityToken(first.token, key, now + 60), first.identity);
  assert.equal(await verifyThrottleIdentityToken(second.token, key, now + 60), second.identity);

  const separator = first.token.indexOf(".");
  const signatureChar = first.token[separator + 1];
  const altered = first.token.slice(0, separator + 1) +
    (signatureChar === "A" ? "B" : "A") + first.token.slice(separator + 2);
  assert.equal(await verifyThrottleIdentityToken(altered, key, now + 60), null);
  assert.equal(await verifyThrottleIdentityToken(
    first.token,
    key,
    now + 30 * 24 * 60 * 60,
  ), null);
});
