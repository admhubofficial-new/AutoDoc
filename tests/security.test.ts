import { describe, expect, it } from "vitest";
import {
  signCookiePayload,
  verifyCookiePayload,
  SESSION_TTL_SECONDS,
  type SessionPayload,
} from "../lib/server/session.js";
import {
  normalizeToken,
  tokenHashFingerprint,
  loginThrottleKey,
} from "../lib/server/security.js";

const secret = "unit-test-only-secret-at-least-32-characters";

describe("signed httpOnly session payload", () => {
  const now = 1_800_000_000;
  const payload: SessionPayload = {
    typ: "session",
    sub: "autodoc",
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    sv: 1,
    nonce: "abcdefghijklmnopqr",
  };

  it("accepts a valid 12-hour signed session", () => {
    const token = signCookiePayload(payload, secret);
    expect(verifyCookiePayload(token, secret, now + 60)).toEqual(payload);
  });

  it("rejects a modified signature", () => {
    const token = signCookiePayload(payload, secret);
    const altered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifyCookiePayload(altered, secret, now + 60)).toBeNull();
  });

  it("rejects an expired session", () => {
    const token = signCookiePayload(payload, secret);
    expect(verifyCookiePayload(token, secret, now + SESSION_TTL_SECONDS + 1)).toBeNull();
  });

  it("rejects a session issued too far in the future", () => {
    const token = signCookiePayload({ ...payload, iat: now + 60, exp: now + 60 + SESSION_TTL_SECONDS }, secret);
    expect(verifyCookiePayload(token, secret, now)).toBeNull();
  });
});

describe("PIN/token validation helpers", () => {
  it("requires 6 to 128 non-empty characters", () => {
    expect(normalizeToken("12345")).toBeNull();
    expect(normalizeToken("123456")).toBe("123456");
    expect(normalizeToken("  ABCDEF  ")).toBe("ABCDEF");
    expect(normalizeToken("x".repeat(129))).toBeNull();
    expect(normalizeToken(123456)).toBeNull();
  });

  it("creates a one-way fingerprint without returning the password hash", () => {
    const fingerprint = tokenHashFingerprint("$2b$12$example");
    expect(fingerprint).toHaveLength(16);
    expect(fingerprint).not.toContain("$2b$");
  });

  it("uses a stable opaque global login-throttle key", () => {
    expect(loginThrottleKey(secret)).toBe(loginThrottleKey(secret));
    expect(loginThrottleKey(secret)).not.toBe(loginThrottleKey(secret + "-different"));
    expect(loginThrottleKey(secret)).toMatch(/^[0-9a-f]{64}$/);
  });
});
