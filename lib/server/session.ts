import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { selectOne } from "./supabase.ts";
import { secureRequest, sessionSecret } from "./env.ts";

export const SESSION_COOKIE = "autodoc_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface SessionPayload {
  typ: "session";
  sub: "autodoc";
  iat: number;
  exp: number;
  sv: number;
  nonce: string;
}

export function signCookiePayload(
  payload: SessionPayload,
  secret: string,
): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return encoded + "." + signature;
}

export function verifyCookiePayload(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, suppliedSignature] = parts;
  const expectedSignature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");

  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;

    if (
      payload.typ !== "session" ||
      payload.sub !== "autodoc" ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp) ||
      !Number.isSafeInteger(payload.sv) ||
      typeof payload.nonce !== "string" ||
      payload.nonce.length < 16
    ) {
      return null;
    }

    const issuedAt = payload.iat as number;
    const expiresAt = payload.exp as number;
    if (
      issuedAt > nowSeconds + 30 ||
      expiresAt <= nowSeconds ||
      expiresAt <= issuedAt ||
      expiresAt - issuedAt > SESSION_TTL_SECONDS
    ) {
      return null;
    }

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function createSessionCookie(
  request: Request,
  sessionVersion: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const payload: SessionPayload = {
    typ: "session",
    sub: "autodoc",
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
    sv: sessionVersion,
    nonce: randomBytes(18).toString("base64url"),
  };
  const value = signCookiePayload(payload, sessionSecret());
  const secure = secureRequest(request) ? "; Secure" : "";
  return (
    SESSION_COOKIE +
    "=" +
    value +
    "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" +
    SESSION_TTL_SECONDS +
    secure
  );
}

export function clearAuthCookies(request: Request): string[] {
  const secure = secureRequest(request) ? "; Secure" : "";
  return [
    SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" + secure,
    "autodoc_stepup=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" + secure,
  ];
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key === name) return item.slice(separator + 1).trim();
  }
  return null;
}

export async function validSession(
  request: Request,
): Promise<SessionPayload | null> {
  const value = cookieValue(request, SESSION_COOKIE);
  if (!value) return null;

  const payload = verifyCookiePayload(value, sessionSecret());
  if (!payload) return null;

  const data = await selectOne<{
    session_version: number;
    setup_completed_at: string | null;
    token_hash: string | null;
  }>("settings", "session_version,setup_completed_at,token_hash", { id: "eq.1" });

  if (!data?.setup_completed_at || !data.token_hash) return null;
  if (Number(data.session_version) !== payload.sv) return null;

  return payload;
}

export async function currentSessionVersion(): Promise<number> {
  const data = await selectOne<{
    session_version: number;
    setup_completed_at: string | null;
    token_hash: string | null;
  }>("settings", "session_version,setup_completed_at,token_hash", { id: "eq.1" });

  if (!data?.setup_completed_at || !data.token_hash) {
    throw new Error("Setup Awal belum selesai.");
  }
  return Number(data.session_version);
}
