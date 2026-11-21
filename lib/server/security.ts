import { createHash, createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sessionSecret } from "./env.js";

export const TOKEN_MIN_LENGTH = 6;
export const TOKEN_MAX_LENGTH = 128;
export const BCRYPT_ROUNDS = 12;

export function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (
    token.length < TOKEN_MIN_LENGTH ||
    token.length > TOKEN_MAX_LENGTH
  ) {
    return null;
  }
  return token;
}

export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, BCRYPT_ROUNDS);
}

export async function tokenMatches(
  token: string,
  hash: string,
): Promise<boolean> {
  if (!hash || !/^\$2[aby]\$/.test(hash)) return false;
  return bcrypt.compare(token, hash);
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

export async function checkThrottle(
  client: SupabaseClient,
  keyHash: string,
): Promise<ThrottleState> {
  const { data, error } = await client
    .from("login_attempts")
    .select("failed_attempts, locked_until")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error) throw error;

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

export async function recordFailedAttempt(
  client: SupabaseClient,
  keyHash: string,
): Promise<ThrottleState> {
  const { data, error } = await client.rpc("record_login_failure", {
    p_key_hash: keyHash,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
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

export async function clearFailedAttempts(
  client: SupabaseClient,
  keyHash: string,
): Promise<void> {
  const { error } = await client
    .from("login_attempts")
    .delete()
    .eq("key_hash", keyHash);
  if (error) throw error;
}

export function tokenHashFingerprint(hash: string): string {
  return createHash("sha256").update(hash).digest("hex").slice(0, 16);
}
