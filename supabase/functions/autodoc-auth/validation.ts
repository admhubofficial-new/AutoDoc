export const TOKEN_MIN_LENGTH = 6;
export const TOKEN_MAX_LENGTH = 128;

export function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return token.length >= TOKEN_MIN_LENGTH && token.length <= TOKEN_MAX_LENGTH
    ? token
    : null;
}


export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidClockTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

export function parseNonNegativeInteger(value: unknown, fallback = 0): number | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return Number.isSafeInteger(fallback) && fallback >= 0 ? fallback : null;
  }
  if (typeof value !== "number" && typeof value !== "string") return null;
  const normalized = typeof value === "string" ? value.trim() : value;
  if (normalized === "") return Number.isSafeInteger(fallback) && fallback >= 0 ? fallback : null;
  const result = Number(normalized);
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}

export function normalizeUuidList(value: unknown, maxItems = 100): string[] | null {
  if (!Number.isSafeInteger(maxItems) || maxItems < 1 || !Array.isArray(value) || value.length < 1 || value.length > maxItems) return null;
  const values: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry)) {
      return null;
    }
    values.push(entry);
  }
  return [...new Set(values)];
}


export function parseContentRangeTotal(value: string | null): number | null {
  if (typeof value !== "string") return null;
  const match = /^(?:\d+-\d+|\*)\/(\d+)$/.exec(value.trim());
  if (!match) return null;
  const total = Number(match[1]);
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}


export class RequestBodyError extends Error {
  readonly status: 400 | 413;

  constructor(status: 400 | 413, message: string) {
    super(message);
    this.name = "RequestBodyError";
    this.status = status;
  }
}

/**
 * Reads a JSON request body without buffering more than maxBytes in memory.
 * Content-Length is only an early-rejection hint; the stream byte count is authoritative.
 */
export async function readBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("Batas body harus bilangan bulat positif.");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const declared = Number(declaredLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new RequestBodyError(413, "Permintaan terlalu besar.");
    }
  }

  if (!request.body) throw new RequestBodyError(400, "Format permintaan tidak valid.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let completed = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        completed = true;
        break;
      }
      if (!value?.byteLength) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel("Batas ukuran permintaan terlampaui.");
        } catch {
          // Cancellation is best-effort; the size limit is already enforced.
        }
        throw new RequestBodyError(413, "Permintaan terlalu besar.");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, "Format permintaan tidak valid.");
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // The stream may already have released its reader after cancellation.
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON harus berupa objek.");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new RequestBodyError(400, "Format permintaan tidak valid.");
  }
}

export class RequestTimeoutError extends Error {
  constructor() {
    super("Permintaan ke layanan eksternal melewati batas waktu.");
    this.name = "RequestTimeoutError";
  }
}

/** Keeps the deadline active until both response headers and the body are read. */
export async function fetchResponseTextWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  fetcher: typeof fetch = fetch,
): Promise<{ response: Response; bodyText: string }> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError("Timeout harus bilangan bulat positif.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(input, { ...init, signal: controller.signal });
    const bodyText = await response.text();
    return { response, bodyText };
  } catch (error) {
    if (controller.signal.aborted) throw new RequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function parseRetryAfterSeconds(
  value: string | null,
  nowMs = Date.now(),
  maxSeconds = 3600,
): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (!Number.isSafeInteger(maxSeconds) || maxSeconds < 1) return null;

  const normalized = value.trim();
  let seconds: number;
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    seconds = Math.ceil(Number(normalized));
  } else {
    const targetMs = Date.parse(normalized);
    if (!Number.isFinite(targetMs)) return null;
    seconds = Math.ceil((targetMs - nowMs) / 1000);
  }
  if (!Number.isFinite(seconds)) return null;
  return Math.min(maxSeconds, Math.max(0, seconds));
}
