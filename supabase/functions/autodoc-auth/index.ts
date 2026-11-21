// AutoDoc authentication backend for the GitHub Pages frontend.
// The PIN is read only from Supabase Edge Function secrets and is never
// returned to the browser or written to logs.
const APP_ORIGIN = "https://admhubofficial-new.github.io";
const COOKIE_NAME = "__Host-autodoc_session";
const SESSION_SECONDS = 12 * 60 * 60;
const MAX_BODY_BYTES = 8 * 1024;
const encoder = new TextEncoder();

class AppError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getEnv(name: string): string | undefined {
  try {
    return Deno.env.get(name) ?? undefined;
  } catch {
    return undefined;
  }
}

function getPinSecret(): string {
  // Support the exact key currently shown in the Supabase dashboard, and
  // the underscore form in case the secret is renamed to PIN_MASUK.
  const value = getEnv("PIN MASUK") ?? getEnv("PIN_MASUK");
  if (!value || value.trim().length < 6 || value.trim().length > 128) {
    throw new AppError(503, "Secret PIN MASUK belum tersedia atau formatnya tidak valid.");
  }
  return value.trim();
}

type AdminConfig = { url: string; key: string; legacyJwt: boolean };

function adminConfig(): AdminConfig {
  const url = getEnv("SUPABASE_URL");
  if (!url) throw new AppError(503, "Konfigurasi Supabase belum tersedia.");

  const legacy = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) {
    return { url: url.replace(/\/+$/, ""), key: legacy, legacyJwt: true };
  }

  const rawKeys = getEnv("SUPABASE_SECRET_KEYS");
  if (rawKeys) {
    try {
      const keys = JSON.parse(rawKeys) as Record<string, string>;
      const key = keys.default ?? Object.values(keys)[0];
      if (typeof key === "string" && key.length > 20) {
        return { url: url.replace(/\/+$/, ""), key, legacyJwt: false };
      }
    } catch {
      // Fall through to the explicit configuration error below.
    }
  }
  throw new AppError(503, "Kunci backend Supabase belum tersedia.");
}

function adminHeaders(config: AdminConfig, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("apikey", config.key);
  headers.set("Accept", "application/json");
  headers.set("Cache-Control", "no-store");
  if (config.legacyJwt) headers.set("Authorization", "Bearer " + config.key);
  return headers;
}

async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const config = adminConfig();
  const headers = adminHeaders(config, init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(config.url + "/rest/v1/" + path, {
    ...init,
    headers,
    cache: "no-store",
  });
  const raw = await response.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  if (!response.ok) {
    const payload = data && typeof data === "object"
      ? data as { message?: string; code?: string }
      : {};
    throw new AppError(
      response.status,
      payload.message ?? "Permintaan database gagal.",
      payload.code,
    );
  }
  return data as T;
}

async function selectOne<T>(
  table: string,
  columns: string,
  filters: Record<string, string>,
): Promise<T | null> {
  const query = new URLSearchParams({ select: columns, ...filters, limit: "1" });
  const rows = await supabaseRequest<T[]>(table + "?" + query.toString());
  return rows[0] ?? null;
}

async function insertRow(table: string, row: Record<string, unknown>): Promise<void> {
  await supabaseRequest<unknown>(table, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
}

async function deleteRows(table: string, filters: Record<string, string>): Promise<void> {
  const query = new URLSearchParams(filters);
  await supabaseRequest<unknown>(table + "?" + query.toString(), {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  return supabaseRequest<T>("rpc/" + encodeURIComponent(name), {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(args),
  });
}

function hmacKey(): Promise<CryptoKey> {
  const config = adminConfig();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(config.key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacHex(value: string): Promise<string> {
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(value)),
  );
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createSessionCookie(sessionVersion: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: sessionVersion,
    iat: now,
    exp: now + SESSION_SECONDS,
    nonce: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
  };
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(encoded)),
  );
  const token = encoded + "." + toBase64Url(signature);
  // Partitioned + SameSite=None supports credentialed calls from GitHub Pages
  // to the Supabase Edge Function on a different site.
  return COOKIE_NAME + "=" + token +
    "; Path=/; Max-Age=" + SESSION_SECONDS +
    "; HttpOnly; Secure; SameSite=None; Partitioned";
}

function clearSessionCookie(): string {
  return COOKIE_NAME +
    "=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT" +
    "; HttpOnly; Secure; SameSite=None; Partitioned";
}

function getCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") ?? "";
  for (const item of raw.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      return item.slice(separator + 1).trim() || null;
    }
  }
  return null;
}

async function validSession(request: Request): Promise<{ version: number } | null> {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  let payload: { v?: number; iat?: number; exp?: number };
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(parts[1]),
      encoder.encode(parts[0]),
    );
    if (!valid) return null;
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(payload.v) ||
    !Number.isSafeInteger(payload.iat) ||
    !Number.isSafeInteger(payload.exp) ||
    (payload.iat as number) > now + 60 ||
    (payload.exp as number) <= now ||
    (payload.exp as number) - (payload.iat as number) > SESSION_SECONDS
  ) return null;

  const settings = await selectOne<{
    setup_completed_at: string | null;
    session_version: number;
  }>("settings", "setup_completed_at,session_version", { id: "eq.1" });

  if (
    !settings?.setup_completed_at ||
    Number(settings.session_version) !== Number(payload.v)
  ) return null;

  return { version: Number(payload.v) };
}

function secureEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return mismatch === 0;
}

function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return token.length >= 6 && token.length <= 128 ? token : null;
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "600",
  });
  if (origin === APP_ORIGIN) headers.set("Access-Control-Allow-Origin", APP_ORIGIN);
  return headers;
}

function respond(
  request: Request,
  body: Record<string, unknown> | null,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  const headers = corsHeaders(request.headers.get("origin"));
  new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new AppError(413, "Permintaan terlalu besar.");
  const raw = await request.text();
  if (encoder.encode(raw).length > MAX_BODY_BYTES) {
    throw new AppError(413, "Permintaan terlalu besar.");
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new AppError(400, "Format permintaan tidak valid.");
  }
}

async function throttleKey(): Promise<string> {
  return hmacHex("autodoc-global-login-throttle-v1");
}

type ThrottleState = {
  attempts: number;
  locked: boolean;
  retryAfterSeconds: number;
};

async function checkThrottle(keyHash: string): Promise<ThrottleState> {
  const row = await selectOne<{
    failed_attempts: number;
    locked_until: string | null;
  }>("login_attempts", "failed_attempts,locked_until", { key_hash: "eq." + keyHash });
  const remaining = row?.locked_until
    ? Date.parse(row.locked_until) - Date.now()
    : 0;
  return {
    attempts: Number(row?.failed_attempts ?? 0),
    locked: remaining > 0,
    retryAfterSeconds: remaining > 0 ? Math.ceil(remaining / 1000) : 0,
  };
}

async function recordFailure(keyHash: string): Promise<ThrottleState> {
  const result = await rpc<Array<{
    failed_attempts: number;
    locked_until: string | null;
    is_locked: boolean;
  }>>("record_login_failure", { p_key_hash: keyHash });
  const row = Array.isArray(result) ? result[0] : null;
  const remaining = row?.locked_until
    ? Date.parse(row.locked_until) - Date.now()
    : 0;
  return {
    attempts: Number(row?.failed_attempts ?? 0),
    locked: Boolean(row?.is_locked) && remaining > 0,
    retryAfterSeconds: remaining > 0 ? Math.ceil(remaining / 1000) : 0,
  };
}

async function clearFailures(keyHash: string): Promise<void> {
  await deleteRows("login_attempts", { key_hash: "eq." + keyHash });
}

function lockResponse(request: Request, seconds: number): Response {
  return respond(
    request,
    { message: "Terlalu banyak percobaan. Akses dikunci selama 15 menit." },
    429,
    { "Retry-After": String(seconds) },
  );
}

async function requireUnlocked(request: Request, keyHash: string): Promise<Response | null> {
  const state = await checkThrottle(keyHash);
  return state.locked ? lockResponse(request, state.retryAfterSeconds) : null;
}

async function handleSetupStatus(request: Request): Promise<Response> {
  if (request.method !== "GET") throw new AppError(405, "Metode tidak diizinkan.");
  const data = await selectOne<{ setup_completed_at: string | null }>(
    "settings",
    "setup_completed_at",
    { id: "eq.1" },
  );
  const complete = Boolean(data?.setup_completed_at);
  return respond(request, { setupRequired: !complete, setupComplete: complete });
}

async function handleSetupComplete(request: Request): Promise<Response> {
  if (request.method !== "POST") throw new AppError(405, "Metode tidak diizinkan.");
  const body = await readJson(request);
  const submittedPin = normalizeToken(body.token);
  const startSj = Number(body.startNumberSj);
  const startBast = Number(body.startNumberBast);
  if (!submittedPin) {
    throw new AppError(400, "Masukkan PIN MASUK yang valid (6–128 karakter).");
  }
  if (
    !Number.isSafeInteger(startSj) || startSj < 1 ||
    !Number.isSafeInteger(startBast) || startBast < 1
  ) {
    throw new AppError(400, "Nomor awal SJ dan BAST harus bilangan bulat minimal 1.");
  }

  const keyHash = await throttleKey();
  const locked = await requireUnlocked(request, keyHash);
  if (locked) return locked;

  const secretPin = getPinSecret();
  if (!secureEqual(submittedPin, secretPin)) {
    const state = await recordFailure(keyHash);
    if (state.locked) return lockResponse(request, state.retryAfterSeconds);
    throw new AppError(401, "PIN MASUK tidak sesuai.");
  }

  try {
    const result = await rpc<{ session_version: number }>(
      "selesaikan_setup_awal_dengan_pin",
      {
        p_token: secretPin,
        p_start_sj: startSj,
        p_start_bast: startBast,
      },
    );
    await clearFailures(keyHash);
    return respond(
      request,
      { success: true, message: "Setup Awal berhasil. Selamat datang di AutoDoc." },
      200,
      { "Set-Cookie": await createSessionCookie(Number(result.session_version)) },
    );
  } catch (error) {
    const code = (error as AppError).code;
    if (code === "55000") throw new AppError(409, "Setup Awal sudah pernah diselesaikan atau tidak tersedia.");
    if (code === "22023") throw new AppError(400, "Data Setup Awal tidak valid.");
    throw error;
  }
}

async function handleLogin(request: Request): Promise<Response> {
  if (request.method !== "POST") throw new AppError(405, "Metode tidak diizinkan.");
  const body = await readJson(request);
  const token = normalizeToken(body.token);
  if (!token) throw new AppError(400, "Masukkan PIN MASUK yang valid.");

  const settings = await selectOne<{ setup_completed_at: string | null }>(
    "settings",
    "setup_completed_at",
    { id: "eq.1" },
  );
  if (!settings?.setup_completed_at) {
    return respond(
      request,
      { code: "SETUP_REQUIRED", message: "Setup Awal harus diselesaikan terlebih dahulu." },
      409,
    );
  }

  const keyHash = await throttleKey();
  const locked = await requireUnlocked(request, keyHash);
  if (locked) return locked;

  const sessionVersion = await rpc<number | null>("authenticate_access_token", {
    p_token: token,
  });
  if (sessionVersion === null) {
    const state = await recordFailure(keyHash);
    if (state.locked) return lockResponse(request, state.retryAfterSeconds);
    throw new AppError(401, "PIN MASUK tidak sesuai.");
  }

  await clearFailures(keyHash);
  await insertRow("audit_log", {
    aksi: "login_berhasil",
    tabel: "settings",
    record_key: "1",
    actor: "token",
    nilai_lama: null,
    nilai_baru: { login: true },
    detail: { metode: "PIN MASUK", hasil: "berhasil" },
  });
  return respond(
    request,
    { success: true, message: "Berhasil masuk." },
    200,
    { "Set-Cookie": await createSessionCookie(Number(sessionVersion)) },
  );
}

async function handleSession(request: Request): Promise<Response> {
  if (request.method !== "GET") throw new AppError(405, "Metode tidak diizinkan.");
  const session = await validSession(request);
  return respond(request, { authenticated: Boolean(session) });
}

async function handleLogout(request: Request): Promise<Response> {
  if (request.method !== "POST") throw new AppError(405, "Metode tidak diizinkan.");
  return respond(
    request,
    { success: true, message: "Sesi telah diakhiri." },
    200,
    { "Set-Cookie": clearSessionCookie() },
  );
}

async function handleVerifyToken(request: Request): Promise<Response> {
  if (request.method !== "POST") throw new AppError(405, "Metode tidak diizinkan.");
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");
  const body = await readJson(request);
  const token = normalizeToken(body.token);
  if (!token) throw new AppError(400, "Masukkan kembali PIN MASUK.");

  const keyHash = await throttleKey();
  const locked = await requireUnlocked(request, keyHash);
  if (locked) return locked;

  const valid = await rpc<boolean>("verify_access_token", { p_token: token });
  if (!valid) {
    const state = await recordFailure(keyHash);
    if (state.locked) return lockResponse(request, state.retryAfterSeconds);
    throw new AppError(401, "PIN MASUK tidak sesuai.");
  }
  await clearFailures(keyHash);
  const purpose = typeof body.purpose === "string" &&
      ["nomor_urut", "pembatalan", "ubah_token", "lainnya"].includes(body.purpose)
    ? body.purpose
    : "lainnya";
  await insertRow("audit_log", {
    aksi: "token_diverifikasi_ulang",
    tabel: "settings",
    record_key: "1",
    actor: "token",
    nilai_lama: null,
    nilai_baru: { verifikasi: "berhasil" },
    detail: { tujuan: purpose },
  });
  return respond(request, { valid: true, message: "Verifikasi PIN berhasil." });
}

async function handleChangeToken(request: Request): Promise<Response> {
  if (request.method !== "POST") throw new AppError(405, "Metode tidak diizinkan.");
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");
  const body = await readJson(request);
  const currentToken = normalizeToken(body.currentToken);
  const newToken = normalizeToken(body.newToken);
  const confirmNewToken = normalizeToken(body.confirmNewToken);
  if (!currentToken || !newToken || !confirmNewToken) {
    throw new AppError(400, "Semua kolom PIN wajib diisi. PIN baru minimal 6 karakter.");
  }
  if (newToken !== confirmNewToken) throw new AppError(400, "Konfirmasi PIN baru tidak sama.");
  if (currentToken === newToken) throw new AppError(400, "PIN baru harus berbeda dari PIN lama.");

  const keyHash = await throttleKey();
  const locked = await requireUnlocked(request, keyHash);
  if (locked) return locked;

  try {
    await rpc("change_access_token", {
      p_current_token: currentToken,
      p_new_token: newToken,
    });
  } catch (error) {
    const code = (error as AppError).code;
    if (code === "28000") {
      const state = await recordFailure(keyHash);
      if (state.locked) return lockResponse(request, state.retryAfterSeconds);
      throw new AppError(401, "PIN lama tidak sesuai.");
    }
    if (code === "22023") throw new AppError(400, "PIN baru tidak valid atau sama dengan PIN lama.");
    throw error;
  }
  await clearFailures(keyHash);
  return respond(
    request,
    { success: true, message: "PIN berhasil diubah. Silakan masuk kembali." },
    200,
    { "Set-Cookie": clearSessionCookie() },
  );
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (origin && origin !== APP_ORIGIN) {
    return new Response(JSON.stringify({ message: "Asal permintaan tidak diizinkan." }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const pathname = new URL(request.url).pathname;
    const base = "/functions/v1/autodoc-auth";
    const route = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\/+/, "") : "";
    switch (route) {
      case "setup/status": return await handleSetupStatus(request);
      case "setup/complete": return await handleSetupComplete(request);
      case "auth/login": return await handleLogin(request);
      case "auth/session": return await handleSession(request);
      case "auth/logout": return await handleLogout(request);
      case "auth/verify-token": return await handleVerifyToken(request);
      case "auth/change-token": return await handleChangeToken(request);
      default: return respond(request, { message: "Endpoint tidak ditemukan." }, 404);
    }
  } catch (error) {
    if (error instanceof AppError) {
      return respond(request, { message: error.message }, error.status);
    }
    // Do not log request bodies, cookies, or environment variables.
    console.error("AutoDoc auth request failed.");
    return respond(request, { message: "Layanan autentikasi belum siap. Periksa konfigurasi Supabase." }, 500);
  }
});
