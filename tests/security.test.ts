import test from "node:test";
import assert from "node:assert/strict";
import {
  signCookiePayload,
  verifyCookiePayload,
  SESSION_TTL_SECONDS,
  type SessionPayload,
} from "../lib/server/session.ts";
import { normalizeToken, loginThrottleKey } from "../lib/server/security.ts";

const secret = "unit-test-only-secret-at-least-32-characters";

test("signed session accepts a valid 12-hour payload", () => {
  const now = 1_800_000_000;
  const payload: SessionPayload = {
    typ: "session",
    sub: "autodoc",
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    sv: 1,
    nonce: "abcdefghijklmnopqr",
  };
  const token = signCookiePayload(payload, secret);
  assert.deepEqual(verifyCookiePayload(token, secret, now + 60), payload);
});

test("signed session rejects a modified signature", () => {
  const now = 1_800_000_000;
  const payload: SessionPayload = {
    typ: "session",
    sub: "autodoc",
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    sv: 1,
    nonce: "abcdefghijklmnopqr",
  };
  const token = signCookiePayload(payload, secret);
  const altered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  assert.equal(verifyCookiePayload(altered, secret, now + 60), null);
});

test("signed session rejects an expired payload", () => {
  const now = 1_800_000_000;
  const payload: SessionPayload = {
    typ: "session",
    sub: "autodoc",
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    sv: 1,
    nonce: "abcdefghijklmnopqr",
  };
  const token = signCookiePayload(payload, secret);
  assert.equal(verifyCookiePayload(token, secret, now + SESSION_TTL_SECONDS + 1), null);
});

test("signed session rejects a future issue time", () => {
  const now = 1_800_000_000;
  const payload: SessionPayload = {
    typ: "session",
    sub: "autodoc",
    iat: now + 60,
    exp: now + 60 + SESSION_TTL_SECONDS,
    sv: 1,
    nonce: "abcdefghijklmnopqr",
  };
  const token = signCookiePayload(payload, secret);
  assert.equal(verifyCookiePayload(token, secret, now), null);
});

test("PIN/token validation requires 6 to 128 characters", () => {
  assert.equal(normalizeToken("12345"), null);
  assert.equal(normalizeToken("123456"), "123456");
  assert.equal(normalizeToken("  ABCDEF  "), "ABCDEF");
  assert.equal(normalizeToken("x".repeat(129)), null);
  assert.equal(normalizeToken(123456), null);
});

test("login throttle key is opaque and stable", () => {
  assert.equal(loginThrottleKey(secret), loginThrottleKey(secret));
  assert.notEqual(loginThrottleKey(secret), loginThrottleKey(secret + "-different"));
  assert.match(loginThrottleKey(secret), /^[0-9a-f]{64}$/);
});
