import { createHmac } from "node:crypto";
import { sessionSecret } from "./env.ts";
import { deleteRows, rpc, selectOne } from "./supabase.ts";

export const TOKEN_MIN_LENGTH = 6;
export const TOKEN_MAX_LENGTH = 128;

export function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (token.length < TOKEN_MIN_LENGTH || token.length > TOKEN_MAX_LENGTH) {
    return null;
  }
  return token;
}

export async function tokenMatches(token: string): Promise<boolean> {
  return rpc<boolean>("verify_access_token", { p_token: token });
}

/** One shared lock for the single shared PIN, not a client-controlled IP key. */
export function loginThrottleKey(secret = sessionSecret()): string {
  return createHmac("sha256", secret)
    .update("autodoc-global-login-throttle-v1")
    .digest("hex");
}

export interface ThrottleState {
  attempts: number;
  locked: boolean;
  retryAfterSeconds: number;
}

export async function checkThrottle(keyHash: string): Promise<ThrottleState> {
  const data = await selectOne<{
    failed_attempts: number;
    locked_until: string | null;
  }>("login_attempts", "failed_attempts,locked_until", {
    key_hash: "eq." + keyHash,
  });

  const lockedUntil = data?.locked_until
    ? new Date(data.locked_until).getTime()
    : 0;
  const remainingMs = lockedUntil - Date.now();

  return {
    attempts: Number(data?.failed_attempts ?? 0),
    locked: remainingMs > 0,
    retryAfterSeconds: remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0,
  };
}

export async function recordFailedAttempt(keyHash: string): Promise<ThrottleState> {
  const data = await rpc<
    Array<{
      failed_attempts: number;
      locked_until: string | null;
      is_locked: boolean;
    }>
  >("record_login_failure", { p_key_hash: keyHash });

  const row = Array.isArray(data) ? data[0] : null;
  const lockedUntil = row?.locked_until
    ? new Date(row.locked_until).getTime()
    : 0;
  const remainingMs = lockedUntil - Date.now();

  return {
    attempts: Number(row?.failed_attempts ?? 0),
    locked: Boolean(row?.is_locked) && remainingMs > 0,
    retryAfterSeconds: remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0,
  };
}

export async function clearFailedAttempts(keyHash: string): Promise<void> {
  await deleteRows("login_attempts", { key_hash: "eq." + keyHash });
}
