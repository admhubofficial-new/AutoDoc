import { signSessionPayload, toBase64Url, verifySessionPayload } from "./session.ts";
import {
  joinMenuComponents,
  normalizeDocumentKinds,
  normalizeMealTime,
  normalizeMenuComponents,
  settingsForDistributionSnapshot,
  WorkflowValidationError,
} from "./distribution-workflow.ts";
import {
  isValidClockTime,
  isValidIsoDate,
  normalizeToken,
  normalizeUuidList,
  parseContentRangeTotal,
  parseNonNegativeInteger,
} from "./validation.ts";

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
async function countRows(table: string, filters: Record<string, string> = {}): Promise<number> {
  const config = adminConfig();
  const query = new URLSearchParams({ select: "id", ...filters });
  const headers = adminHeaders(config, {
    Prefer: "count=exact",
    "Range-Unit": "items",
    Range: "0-0",
  });
  const response = await fetch(config.url + "/rest/v1/" + table + "?" + query.toString(), {
    method: "HEAD",
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new AppError(response.status, "Gagal membaca ringkasan tabel " + table + ".");
  }
  const total = parseContentRangeTotal(response.headers.get("content-range"));
  if (total === null) {
    throw new AppError(502, "Server tidak mengirim jumlah data yang valid untuk " + table + ".");
  }
  return total;
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
  const token = await signSessionPayload(payload, await hmacKey());
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
  const now = Math.floor(Date.now() / 1000);
  const payload = await verifySessionPayload(token, await hmacKey(), now, SESSION_SECONDS);
  if (!payload) return null;

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

async function readJson(request: Request, maxBytes = MAX_BODY_BYTES): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new AppError(413, "Permintaan terlalu besar.");
  const raw = await request.text();
  if (encoder.encode(raw).length > maxBytes) {
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



const MASTER_CONFIG = {
  settings: { table: "settings", columns: "id,nama_sppg,kode_sppg,alamat,kecamatan,kabupaten,kabupaten_perlu_verifikasi,kabupaten_catatan_verifikasi,nama_kepala_sppg,nama_kepala_sppi,nama_ahli_gizi,logo_path", order: "id.asc" },
  recipients: { table: "recipients", columns: "id,kelompok,nama,jenjang,aktif,urutan,alamat,siswa_kecil,siswa_besar,tendik,ibu_hamil,ibu_menyusui,balita,putus_sekolah,kader,porsi_kecil,porsi_besar,total_porsi,keterangan,perlu_verifikasi,catatan_verifikasi", order: "urutan.asc,nama.asc" },
  drivers: { table: "master_pengemudi", columns: "id,nama,aktif,urutan", order: "urutan.asc,nama.asc" },
  vehicles: { table: "master_kendaraan", columns: "id,no_kendaraan,aktif,urutan", order: "urutan.asc,no_kendaraan.asc" },
  staff: { table: "master_petugas", columns: "id,nama,jabatan,aktif,urutan", order: "urutan.asc,nama.asc" },
  menus: { table: "master_menu", columns: "id,teks_menu,aktif,urutan", order: "urutan.asc,teks_menu.asc" },
} as const;

type MasterEntity = keyof typeof MASTER_CONFIG;

function masterEntity(value: unknown): MasterEntity {
  if (typeof value !== "string" || !(value in MASTER_CONFIG)) {
    throw new AppError(400, "Jenis data master tidak dikenal.");
  }
  return value as MasterEntity;
}

function cleanText(value: unknown, field: string, required = false, max = 300): string | null {
  if (value === null || value === undefined || value === "") {
    if (required) throw new AppError(400, field + " wajib diisi.");
    return null;
  }
  if (typeof value !== "string") throw new AppError(400, field + " tidak valid.");
  const result = value.trim();
  if (required && !result) throw new AppError(400, field + " wajib diisi.");
  if (result.length > max) throw new AppError(400, field + " terlalu panjang.");
  return result || null;
}

function cleanInteger(value: unknown, field: string, fallback = 0): number {
  const result = parseNonNegativeInteger(value, fallback);
  if (result === null) throw new AppError(400, field + " harus bilangan bulat minimal 0.");
  return result;
}

function cleanOrder(value: unknown): number {
  const result = cleanInteger(value, "Urutan", 100);
  if (result < 1) throw new AppError(400, "Urutan harus bilangan bulat minimal 1.");
  return result;
}

function masterPayload(entity: MasterEntity, input: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (entity === "settings") {
    data.nama_sppg = cleanText(input.nama_sppg, "Nama SPPG", true, 150);
    data.kode_sppg = cleanText(input.kode_sppg, "Kode SPPG", true, 40);
    data.alamat = cleanText(input.alamat, "Alamat", false, 500);
    data.kecamatan = cleanText(input.kecamatan, "Kecamatan", true, 100);
    data.kabupaten = cleanText(input.kabupaten, "Kabupaten", true, 100);
    data.nama_kepala_sppg = cleanText(input.nama_kepala_sppg, "Nama Kepala SPPG", false, 150);
    if ("nama_kepala_sppi" in input) data.nama_kepala_sppi = cleanText(input.nama_kepala_sppi, "Nama Kepala SPPI", false, 150);
    if ("nama_ahli_gizi" in input) data.nama_ahli_gizi = cleanText(input.nama_ahli_gizi, "Nama Ahli Gizi Dapur", false, 150);
    data.kabupaten_perlu_verifikasi = input.kabupaten_perlu_verifikasi === true;
    data.kabupaten_catatan_verifikasi = cleanText(input.kabupaten_catatan_verifikasi, "Catatan verifikasi", false, 500);
    return data;
  }
  if (entity === "recipients") {
    const kelompok = cleanText(input.kelompok, "Kelompok", true, 40);
    if (kelompok !== "Sekolah/Lembaga" && kelompok !== "Posyandu") throw new AppError(400, "Kelompok penerima tidak valid.");
    data.kelompok = kelompok;
    data.nama = cleanText(input.nama, "Nama penerima", true, 180);
    data.jenjang = cleanText(input.jenjang, "Jenjang", true, 80);
    data.alamat = cleanText(input.alamat, "Alamat", false, 500);
    for (const field of ["siswa_kecil","siswa_besar","tendik","ibu_hamil","ibu_menyusui","balita","putus_sekolah","kader"]) data[field] = cleanInteger(input[field], field, 0);
    data.urutan = cleanOrder(input.urutan);
    data.aktif = input.aktif !== false;
    data.keterangan = cleanText(input.keterangan, "Keterangan", false, 1000);
    data.perlu_verifikasi = input.perlu_verifikasi === true;
    data.catatan_verifikasi = cleanText(input.catatan_verifikasi, "Catatan verifikasi", false, 1000);
    return data;
  }
  if (entity === "drivers" || entity === "staff" || entity === "menus" || entity === "vehicles") {
    const field = entity === "vehicles" ? "no_kendaraan" : entity === "menus" ? "teks_menu" : "nama";
    data[field] = cleanText(input[field], entity === "vehicles" ? "Nomor kendaraan" : entity === "menus" ? "Menu" : "Nama", true, 180);
    if (entity === "staff") data.jabatan = cleanText(input.jabatan, "Jabatan", false, 120);
    data.aktif = input.aktif !== false;
    data.urutan = cleanOrder(input.urutan);
    return data;
  }
  throw new AppError(400, "Jenis data master tidak didukung.");
}

async function handleMasterRecipients(request: Request): Promise<Response> {
  if (request.method !== "GET") throw new AppError(405, "Metode tidak diizinkan.");
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");
  const config = MASTER_CONFIG.recipients;
  const query = new URLSearchParams({ select: config.columns, order: config.order, aktif: "eq.true" });
  const recipients = await supabaseRequest<Record<string, unknown>[]>(config.table + "?" + query.toString());
  return respond(request, { recipients, count: recipients.length });
}

async function handleMasterList(request: Request): Promise<Response> {
  if (request.method !== "GET") throw new AppError(405, "Metode tidak diizinkan.");
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");
  const data: Record<string, unknown> = {};
  const includeRecipients = new URL(request.url).searchParams.get("include_recipients") !== "false";
  for (const entity of Object.keys(MASTER_CONFIG) as MasterEntity[]) {
    if (entity === "recipients" && !includeRecipients) {
      data[entity] = [];
      continue;
    }
    const config = MASTER_CONFIG[entity];
    const query = new URLSearchParams({ select: config.columns, order: config.order });
    if (entity === "settings") query.set("id", "eq.1");
    data[entity] = await supabaseRequest<unknown[]>(config.table + "?" + query.toString());
  }
  return respond(request, { data });
}

async function handleMasterSave(request: Request): Promise<Response> {
  if (request.method !== "POST") throw new AppError(405, "Metode tidak diizinkan.");
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");
  const body = await readJson(request);
  const entity = masterEntity(body.entity);
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new AppError(400, "Data yang dikirim tidak valid.");
  const input = body.data as Record<string, unknown>;
  const data = masterPayload(entity, input);
  const config = MASTER_CONFIG[entity];
  const id = entity === "settings" ? "1" : typeof input.id === "string" ? input.id : "";
  let result: unknown;
  if (id) {
    const query = new URLSearchParams({ id: "eq." + id, select: config.columns });
    result = await supabaseRequest<unknown[]>(config.table + "?" + query.toString(), {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(data),
    });
    if (!Array.isArray(result) || result.length === 0) throw new AppError(404, "Data yang akan diperbarui tidak ditemukan.");
  } else {
    result = await supabaseRequest<unknown[]>(config.table + "?select=" + encodeURIComponent(config.columns), {
      method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(data),
    });
  }
  return respond(request, { success: true, data: Array.isArray(result) ? result[0] : result });
}

async function handleMasterImport(request: Request): Promise<Response> {
  if (request.method !== "POST") throw new AppError(405, "Metode tidak diizinkan.");
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");
  const body = await readJson(request, 512 * 1024);
  if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 500) throw new AppError(400, "Impor harus berisi 1 sampai 500 baris.");
  const rows = body.rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new AppError(400, "Format baris impor tidak valid.");
    return masterPayload("recipients", row as Record<string, unknown>);
  });
  const query = new URLSearchParams({ on_conflict: "kelompok,nama", select: MASTER_CONFIG.recipients.columns });
  const result = await supabaseRequest<unknown[]>(MASTER_CONFIG.recipients.table + "?" + query.toString(), {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(rows),
  });
  return respond(request, { success: true, imported: Array.isArray(result) ? result.length : rows.length });
}



async function verifyMutationPin(request: Request, rawToken: unknown, purpose: string): Promise<void> {
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");
  const token = normalizeToken(rawToken);
  if (!token) throw new AppError(400, "Masukkan PIN akses untuk mengonfirmasi tindakan ini.");
  const keyHash = await throttleKey();
  const locked = await requireUnlocked(request, keyHash);
  if (locked) throw new AppError(429, "Akses terkunci sementara. Coba kembali setelah masa penguncian berakhir.");
  const valid = await rpc<boolean>("verify_access_token", { p_token: token });
  if (!valid) {
    const state = await recordFailure(keyHash);
    if (state.locked) throw new AppError(429, "Terlalu banyak percobaan. Akses dikunci selama 15 menit.");
    throw new AppError(401, "PIN akses tidak sesuai.");
  }
  await clearFailures(keyHash);
  await insertRow("audit_log", {
    aksi: "pin_dikonfirmasi_ulang",
    tabel: "settings",
    record_key: "1",
    actor: "token",
    nilai_lama: null,
    nilai_baru: { verifikasi: "berhasil" },
    detail: { tujuan: purpose },
  });
}

function validIsoDate(value: unknown): value is string {
  return isValidIsoDate(value);
}

function uuidList(value: unknown, maxItems = 100, label = "penerima"): string[] {
  const result = normalizeUuidList(value, maxItems);
  if (!result) throw new AppError(400, `Pilih 1 sampai ${maxItems} ${label} dengan identitas yang valid.`);
  return result;
}

function distributionSnapshotRows(recipient: Record<string, unknown>): Array<Record<string, unknown>> {
  const definitions = [
    ["siswa_kecil", "Siswa kecil", "Porsi Kecil"],
    ["balita", "Balita", "Porsi Kecil"],
    ["siswa_besar", "Siswa besar", "Porsi Besar"],
    ["tendik", "Tenaga pendidik", "Porsi Besar"],
    ["ibu_hamil", "Ibu hamil", "Porsi Besar"],
    ["ibu_menyusui", "Ibu menyusui", "Porsi Besar"],
    ["putus_sekolah", "Anak putus sekolah", "Porsi Besar"],
    ["kader", "Kader", "Porsi Besar"],
  ] as const;
  return definitions.flatMap(([key, label, jenis]) => {
    const jumlah = Number(recipient[key] ?? 0);
    return jumlah > 0 ? [{ kelompok_sasaran: label, jenis_porsi: jenis, jumlah }] : [];
  });
}


async function handleDashboardSummary(request: Request): Promise<Response> {
  if (request.method !== "GET") throw new AppError(405, "Metode tidak diizinkan.");
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");

  const [
    distributionsTotal,
    documentsTotal,
    documentsSj,
    documentsBast,
    statusDibuat,
    statusDicetak,
    statusDitandatangani,
    statusSelesai,
    statusBatal,
    pendingBast,
    recipientsTotal,
    recipientsActive,
    recipientsNeedingVerification,
    recipientsMissingAddress,
    driversActive,
    vehiclesActive,
    staffActive,
    menusActive,
    settings,
    recentRows,
  ] = await Promise.all([
    countRows("distributions"),
    countRows("documents"),
    countRows("documents", { jenis: "eq.SJ" }),
    countRows("documents", { jenis: "eq.BAST" }),
    countRows("documents", { status: "eq.dibuat" }),
    countRows("documents", { status: "eq.dicetak" }),
    countRows("documents", { status: "eq.ditandatangani" }),
    countRows("documents", { status: "eq.selesai" }),
    countRows("documents", { status: "eq.batal" }),
    countRows("documents", { jenis: "eq.BAST", status: "in.(dibuat,dicetak,ditandatangani)" }),
    countRows("recipients"),
    countRows("recipients", { aktif: "eq.true" }),
    countRows("recipients", { aktif: "eq.true", perlu_verifikasi: "eq.true" }),
    countRows("recipients", { aktif: "eq.true", or: "(alamat.is.null,alamat.eq.)" }),
    countRows("master_pengemudi", { aktif: "eq.true" }),
    countRows("master_kendaraan", { aktif: "eq.true" }),
    countRows("master_petugas", { aktif: "eq.true" }),
    countRows("master_menu", { aktif: "eq.true" }),
    selectOne<Record<string, unknown>>(
      "settings",
      "nama_sppg,kode_sppg,alamat,kecamatan,kabupaten,nama_kepala_sppg,nama_kepala_sppi,nama_ahli_gizi",
      { id: "eq.1" },
    ),
    supabaseRequest<Array<Record<string, unknown>>>(
      "distributions?" + new URLSearchParams({
        select: "id,tanggal,menu,nama_petugas,nama_pengemudi,no_kendaraan",
        order: "tanggal.desc",
        limit: "5",
      }).toString(),
    ),
  ]);

  const missingSppgFields = !settings
    || !String(settings.nama_sppg ?? "").trim()
    || !String(settings.kode_sppg ?? "").trim()
    || !String(settings.alamat ?? "").trim()
    || !String(settings.nama_kepala_sppg ?? "").trim();
  const ahliGiziMissing = !settings || !String(settings.nama_ahli_gizi ?? "").trim();
  const supportMasterMissing = [
    driversActive === 0,
    vehiclesActive === 0,
    staffActive === 0,
    menusActive === 0,
  ].filter(Boolean).length;

  const recentDistributions = await Promise.all(recentRows.map(async (row) => {
    const distributionId = String(row.id);
    const [documentsCount, bastPendingCount] = await Promise.all([
      countRows("documents", { distribution_id: "eq." + distributionId }),
      countRows("documents", {
        distribution_id: "eq." + distributionId,
        jenis: "eq.BAST",
        status: "in.(dibuat,dicetak,ditandatangani)",
      }),
    ]);
    return {
      id: distributionId,
      tanggal: String(row.tanggal),
      menu: row.menu ?? null,
      nama_petugas: row.nama_petugas ?? null,
      nama_pengemudi: row.nama_pengemudi ?? null,
      no_kendaraan: row.no_kendaraan ?? null,
      documents_count: documentsCount,
      bast_pending: bastPendingCount,
    };
  }));

  return respond(request, {
    generated_at: new Date().toISOString(),
    counts: {
      distributions: distributionsTotal,
      documents: documentsTotal,
      surat_jalan: documentsSj,
      bast: documentsBast,
      bast_pending: pendingBast,
      dibuat: statusDibuat,
      dicetak: statusDicetak,
      ditandatangani: statusDitandatangani,
      selesai: statusSelesai,
      batal: statusBatal,
      recipients_total: recipientsTotal,
      recipients_active: recipientsActive,
      recipients_missing_address: recipientsMissingAddress,
      recipients_need_verification: recipientsNeedingVerification,
      drivers_active: driversActive,
      vehicles_active: vehiclesActive,
      staff_active: staffActive,
      menus_active: menusActive,
      support_master_missing: supportMasterMissing,
      sppg_missing_fields: missingSppgFields ? 1 : 0,
      ahli_gizi_missing: ahliGiziMissing ? 1 : 0,
    },
    recent_distributions: recentDistributions,
  });
}

async function handleDocsCreate(request: Request): Promise<Response> {
  if (request.method !== "POST") throw new AppError(405, "Metode tidak diizinkan.");
  const body = await readJson(request);
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");

  if (!validIsoDate(body.tanggal)) throw new AppError(400, "Tanggal distribusi tidak valid.");
  const recipientIds = uuidList(body.recipient_ids, 100, "penerima");

  let menuItems: string[];
  let documentKinds: Array<"SJ" | "BAST">;
  let waktuMakan: "pagi" | "siang" | "sore";
  try {
    menuItems = normalizeMenuComponents(body.menu_items, body.menu);
    documentKinds = normalizeDocumentKinds(body.jenis_dokumen);
    waktuMakan = normalizeMealTime(body.waktu_makan);
  } catch (error) {
    if (error instanceof WorkflowValidationError) throw new AppError(400, error.message);
    throw error;
  }

  const namaPetugas = cleanText(body.nama_petugas, "Nama petugas", false, 180);
  const namaPengemudi = cleanText(body.nama_pengemudi, "Nama pengemudi", false, 180);
  const noKendaraan = cleanText(body.no_kendaraan, "Nomor kendaraan", false, 80);
  const jamBerangkat = cleanText(body.jam_berangkat, "Jam berangkat", false, 8);
  if (jamBerangkat && !isValidClockTime(jamBerangkat)) {
    throw new AppError(400, "Format jam berangkat harus HH:MM.");
  }

  const [settings, recipients] = await Promise.all([
    selectOne<Record<string, unknown>>(
      "settings",
      "nama_sppg,kode_sppg,alamat,kecamatan,kabupaten,nama_kepala_sppg,nama_kepala_sppi,nama_ahli_gizi,logo_path",
      { id: "eq.1" },
    ),
    supabaseRequest<Record<string, unknown>[]>(
      "recipients?" + new URLSearchParams({
        select: "id,kelompok,nama,jenjang,alamat,siswa_kecil,siswa_besar,tendik,ibu_hamil,ibu_menyusui,balita,putus_sekolah,kader,porsi_kecil,porsi_besar,total_porsi,keterangan,perlu_verifikasi,catatan_verifikasi,aktif,urutan",
        id: "in.(" + recipientIds.join(",") + ")",
        aktif: "eq.true",
        order: "urutan.asc,nama.asc",
      }).toString(),
    ),
  ]);
  if (!settings) throw new AppError(503, "Identitas SPPG belum tersedia.");
  if (recipients.length !== recipientIds.length) {
    throw new AppError(400, "Ada penerima yang tidak ditemukan atau sudah nonaktif. Muat ulang daftar penerima.");
  }

  let distribution: Record<string, unknown>;
  try {
    distribution = await rpc<Record<string, unknown>>("simpan_distribusi_dan_menu", {
      p_tanggal: body.tanggal,
      p_menu_items: menuItems,
      p_waktu_makan: waktuMakan,
      p_nama_petugas: namaPetugas,
      p_nama_pengemudi: namaPengemudi,
      p_no_kendaraan: noKendaraan,
      p_jam_berangkat: jamBerangkat,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "55000") {
      throw new AppError(
        409,
        "Tanggal ini sudah memiliki dokumen. Gunakan data perjalanan yang sama agar snapshot dokumen lama tidak berubah: menu, komponen menu, waktu makan, petugas, pengemudi, kendaraan, dan jam berangkat harus sama dengan data yang telah diterbitkan.",
      );
    }
    throw error;
  }
  if (!distribution?.id) throw new AppError(500, "Data distribusi tidak berhasil disiapkan.");

  const distributionPayload = {
    tanggal: body.tanggal,
    menu: distribution.menu ?? joinMenuComponents(menuItems),
    menu_items: distribution.menu_items ?? menuItems,
    nama_petugas: namaPetugas,
    nama_pengemudi: namaPengemudi,
    no_kendaraan: noKendaraan,
    jam_berangkat: jamBerangkat,
    waktu_makan: distribution.waktu_makan ?? waktuMakan,
    nama_ahli_gizi: distribution.nama_ahli_gizi ?? null,
  };
  const sppgSnapshot = settingsForDistributionSnapshot(settings, distribution);

  const tasks = recipients.flatMap((recipient) => {
    const detail = distributionSnapshotRows(recipient);
    const snapshot = {
      versi: 2,
      dibuat_pada: new Date().toISOString(),
      sppg: sppgSnapshot,
      distribusi: { ...distributionPayload, id: distribution.id },
      penerima: recipient,
      rincian_porsi: detail,
      ringkasan: {
        porsi_kecil: Number(recipient.porsi_kecil ?? 0),
        porsi_besar: Number(recipient.porsi_besar ?? 0),
        total_porsi: Number(recipient.total_porsi ?? 0),
      },
    };
    return documentKinds.map((jenis) => ({
      recipientId: String(recipient.id),
      jenis,
      snapshot,
    }));
  });

  const results: Array<Record<string, unknown>> = [];
  const failures: Array<Record<string, unknown>> = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, tasks.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= tasks.length) return;
      const task = tasks[index];
      try {
        const result = await rpc<Record<string, unknown>>("buat_dokumen_dengan_nomor", {
          p_distribution_id: String(distribution.id),
          p_recipient_id: task.recipientId,
          p_jenis: task.jenis,
          p_snapshot_json: task.snapshot,
        });
        results.push({ ...result, jenis: task.jenis, recipient_id: task.recipientId });
      } catch (error) {
        failures.push({
          jenis: task.jenis,
          recipient_id: task.recipientId,
          message: error instanceof Error ? error.message : "Gagal membuat dokumen.",
        });
      }
    }
  });
  await Promise.all(workers);

  return respond(request, {
    success: failures.length === 0,
    distribution_id: distribution.id,
    tanggal: distribution.tanggal ?? body.tanggal,
    requested: tasks.length,
    berhasil: results.length,
    gagal: failures.length,
    selected_document_kinds: documentKinds,
    documents: results,
    errors: failures,
    message: failures.length === 0
      ? "Dokumen berhasil disiapkan. Nomor dokumen yang sudah ada digunakan kembali."
      : "Sebagian dokumen berhasil dibuat. Jalankan ulang tanggal yang sama untuk melengkapi dokumen yang gagal.",
  }, failures.length === 0 ? 200 : 207);
}

async function handleDocsDays(request: Request): Promise<Response> {
  if (request.method !== "GET") throw new AppError(405, "Metode tidak diizinkan.");
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");

  const url = new URL(request.url);
  const rawOffset = url.searchParams.get("offset");
  const offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) {
    throw new AppError(400, "Halaman arsip tidak valid.");
  }
  const rawSearch = (url.searchParams.get("q") ?? "").trim();
  if (rawSearch.length > 100) throw new AppError(400, "Kata pencarian maksimal 100 karakter.");
  const search = rawSearch.replace(/[^\p{L}\p{N}\s./-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const filters: Record<string, string> = {
    select: "id,tanggal,menu,nama_petugas,nama_pengemudi,no_kendaraan,jam_berangkat,waktu_makan,nama_ahli_gizi,created_at",
    order: "tanggal.desc",
    limit: "61",
    offset: String(offset),
  };
  if (search) {
    let isoDate = search;
    const localDate = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(search);
    if (localDate) isoDate = localDate[3] + "-" + localDate[2] + "-" + localDate[1];
    if (isValidIsoDate(isoDate)) {
      filters.tanggal = "eq." + isoDate;
    } else {
      const pattern = "*" + search.replace(/[,*()]/g, " ") + "*";
      filters.or = "(menu.ilike." + pattern +
        ",nama_petugas.ilike." + pattern +
        ",nama_pengemudi.ilike." + pattern +
        ",no_kendaraan.ilike." + pattern + ")";
    }
  }
  const rows = await supabaseRequest<unknown[]>(
    "distributions?" + new URLSearchParams(filters).toString(),
  );
  return respond(request, {
    distributions: rows.slice(0, 60),
    offset,
    has_more: rows.length > 60,
    search,
  });
}

async function handleDocsDeleteHistory(request: Request): Promise<Response> {
  if (request.method !== "POST") throw new AppError(405, "Metode tidak diizinkan.");
  const body = await readJson(request);
  await verifyMutationPin(request, body.token, "hapus_riwayat_distribusi");
  const distributionIds = uuidList(body.distribution_ids, 60, "riwayat distribusi");
  const result = await rpc<Record<string, unknown>>("hapus_riwayat_distribusi", {
    p_distribution_ids: distributionIds,
  });
  return respond(request, {
    success: true,
    deleted_distributions: Number(result?.deleted_distributions ?? 0),
    deleted_documents: Number(result?.deleted_documents ?? 0),
    message: "Riwayat distribusi dan dokumen terkait berhasil dihapus. Nomor dokumen tidak direset.",
  });
}

async function handleDocsList(request: Request): Promise<Response> {
  if (request.method !== "GET") throw new AppError(405, "Metode tidak diizinkan.");
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");
  const url = new URL(request.url);
  const tanggal = url.searchParams.get("tanggal");
  if (!validIsoDate(tanggal)) throw new AppError(400, "Tanggal riwayat tidak valid.");
  const distribution = await selectOne<Record<string, unknown>>(
    "distributions",
    "id,tanggal,menu,nama_petugas,nama_pengemudi,no_kendaraan,jam_berangkat,waktu_makan,nama_ahli_gizi",
    { tanggal: "eq." + tanggal },
  );
  if (!distribution?.id) return respond(request, { distribution: null, documents: [] });
  const menuItems = await supabaseRequest<Array<Record<string, unknown>>>(
    "distribution_menu_items?" + new URLSearchParams({
      select: "id,distribution_id,urutan,nama_komponen",
      distribution_id: "eq." + String(distribution.id),
      order: "urutan.asc",
      limit: "8",
    }).toString(),
  );
  (distribution as Record<string, unknown>).menu_items = menuItems;
  const docs = await supabaseRequest<Array<Record<string, unknown>>>(
    "documents?" + new URLSearchParams({
      select: "id,distribution_id,recipient_id,jenis,nomor_urut,nomor_lengkap,snapshot_json,status,alasan_batal,file_ttd_path,created_at",
      distribution_id: "eq." + String(distribution.id),
      order: "jenis.asc,nomor_urut.asc",
      limit: "300",
    }).toString(),
  );
  const bastIds = docs.filter((doc) => doc.jenis === "BAST").map((doc) => String(doc.id));
  if (bastIds.length) {
    const inFilter = "in.(" + bastIds.join(",") + ")";
    const [realisasi, items] = await Promise.all([
      supabaseRequest<Array<Record<string, unknown>>>(
        "bast_realisasi?" + new URLSearchParams({
          select: "document_id,kondisi,jam_diterima,suhu_c,ompreng_kembali,catatan,nama_penerima,jabatan_penerima",
          document_id: inFilter,
        }).toString(),
      ),
      supabaseRequest<Array<Record<string, unknown>>>(
        "bast_realisasi_items?" + new URLSearchParams({
          select: "document_id,urutan,kelompok_sasaran,jenis_porsi,jumlah_diserahkan,jumlah_diterima,keterangan",
          document_id: inFilter,
          order: "urutan.asc",
        }).toString(),
      ),
    ]);
    const byId = new Map(realisasi.map((row) => [String(row.document_id), row]));
    const itemsById = new Map<string, Array<Record<string, unknown>>>();
    for (const row of items) {
      const id = String(row.document_id);
      const current = itemsById.get(id) ?? [];
      current.push(row);
      itemsById.set(id, current);
    }
    for (const doc of docs) {
      if (doc.jenis !== "BAST") continue;
      const row = byId.get(String(doc.id));
      doc.realisasi = row ? { ...row, items: itemsById.get(String(doc.id)) ?? [] } : null;
    }
  }
  return respond(request, { distribution, documents: docs });
}

async function handleDocsMarkPrinted(request: Request): Promise<Response> {
  if (request.method !== "POST") throw new AppError(405, "Metode tidak diizinkan.");
  if (!(await validSession(request))) throw new AppError(401, "Sesi berakhir. Silakan masuk kembali.");
  const body = await readJson(request);
  if (typeof body.document_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.document_id)) {
    throw new AppError(400, "Identitas dokumen tidak valid.");
  }
  const query = new URLSearchParams({
    id: "eq." + body.document_id,
    status: "eq.dibuat",
    select: "id,status",
  });
  const rows = await supabaseRequest<Array<Record<string, unknown>>>("documents?" + query.toString(), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "dicetak" }),
  });
  if (Array.isArray(rows) && rows.length > 0) return respond(request, { success: true, updated: true });
  const existing = await selectOne<Record<string, unknown>>("documents", "id,status", { id: "eq." + body.document_id });
  return respond(request, { success: true, updated: existing?.status === "dicetak" });
}

async function handleDocsRealization(request: Request): Promise<Response> {
  if (request.method !== "POST") throw new AppError(405, "Metode tidak diizinkan.");
  const body = await readJson(request);
  await verifyMutationPin(request, body.token, "realisasi_bast");

  if (typeof body.document_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.document_id)) {
    throw new AppError(400, "Identitas dokumen BAST tidak valid.");
  }
  const document = await selectOne<Record<string, unknown>>(
    "documents",
    "id,jenis,snapshot_json,status",
    { id: "eq." + body.document_id },
  );
  if (!document || document.jenis !== "BAST") throw new AppError(404, "Dokumen BAST tidak ditemukan.");
  if (document.status === "batal") throw new AppError(409, "Dokumen BAST yang dibatalkan tidak dapat direalisasikan.");

  const condition = cleanText(body.kondisi, "Kondisi makanan", true, 20);
  if (!["baik", "kurang baik", "tidak layak"].includes(condition ?? "")) {
    throw new AppError(400, "Pilih kondisi makanan yang valid.");
  }
  const jamDiterima = cleanText(body.jam_diterima, "Jam diterima", true, 8);
  if (!jamDiterima || !isValidClockTime(jamDiterima)) {
    throw new AppError(400, "Jam diterima harus berformat HH:MM.");
  }
  const snapshot = document.snapshot_json as Record<string, unknown>;
  const recipient = (snapshot.penerima ?? {}) as Record<string, unknown>;
  const deliveredSmall = Number(recipient.porsi_kecil ?? 0);
  const deliveredLarge = Number(recipient.porsi_besar ?? 0);
  const receivedSmall = cleanInteger(body.diterima_kecil, "Jumlah porsi kecil diterima", 0);
  const receivedLarge = cleanInteger(body.diterima_besar, "Jumlah porsi besar diterima", 0);
  if (receivedSmall > deliveredSmall || receivedLarge > deliveredLarge) {
    throw new AppError(400, "Jumlah diterima tidak boleh melebihi jumlah yang diserahkan.");
  }
  let suhu: number | null = null;
  if (body.suhu_c !== undefined && body.suhu_c !== null && body.suhu_c !== "") {
    suhu = Number(body.suhu_c);
    if (!Number.isFinite(suhu) || suhu < -50 || suhu > 100) throw new AppError(400, "Suhu harus berada pada rentang -50 sampai 100 °C.");
  }
  const ompreng = body.ompreng_kembali === undefined || body.ompreng_kembali === null || body.ompreng_kembali === ""
    ? null
    : cleanInteger(body.ompreng_kembali, "Jumlah ompreng kembali");
  const realisasiPayload = {
    document_id: document.id,
    kondisi: condition,
    jam_diterima: jamDiterima,
    suhu_c: suhu,
    ompreng_kembali: ompreng,
    catatan: cleanText(body.catatan, "Catatan", false, 1000),
    nama_penerima: cleanText(body.nama_penerima, "Nama penerima BAST", true, 180),
    jabatan_penerima: cleanText(body.jabatan_penerima, "Jabatan penerima", false, 120),
  };
  const itemsPayload = [
    {
      urutan: 1,
      kelompok_sasaran: "Total",
      jenis_porsi: "Porsi Kecil",
      jumlah_diserahkan: deliveredSmall,
      jumlah_diterima: receivedSmall,
      keterangan: null,
    },
    {
      urutan: 2,
      kelompok_sasaran: "Total",
      jenis_porsi: "Porsi Besar",
      jumlah_diserahkan: deliveredLarge,
      jumlah_diterima: receivedLarge,
      keterangan: null,
    },
  ];
  await rpc("simpan_realisasi_bast", {
    p_document_id: document.id,
    p_realisasi: realisasiPayload,
    p_items: itemsPayload,
  });
  return respond(request, { success: true, message: "Realisasi BAST berhasil disimpan." });
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
    // Supabase Edge Runtime uses /<function-name>/<route> internally.
    // Accept both that form and the public /functions/v1/<function-name> form.
    const functionMarker = "/autodoc-auth";
    const markerIndex = pathname.indexOf(functionMarker);
    const route = markerIndex >= 0
      ? pathname.slice(markerIndex + functionMarker.length).split("/").filter(Boolean).join("/")
      : "";
    switch (route) {
      case "setup/status": return await handleSetupStatus(request);
      case "setup/complete": return await handleSetupComplete(request);
      case "auth/login": return await handleLogin(request);
      case "auth/session": return await handleSession(request);
      case "auth/logout": return await handleLogout(request);
      case "auth/verify-token": return await handleVerifyToken(request);
      case "auth/change-token": return await handleChangeToken(request);
      case "master/list": return await handleMasterList(request);
      case "master/recipients": return await handleMasterRecipients(request);
      case "master/save": return await handleMasterSave(request);
      case "master/import": return await handleMasterImport(request);
      case "dashboard/summary": return await handleDashboardSummary(request);
      case "docs/create": return await handleDocsCreate(request);
      case "docs/days": return await handleDocsDays(request);
      case "docs/delete-history": return await handleDocsDeleteHistory(request);
      case "docs/list": return await handleDocsList(request);
      case "docs/mark-printed": return await handleDocsMarkPrinted(request);
      case "docs/realization": return await handleDocsRealization(request);
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
