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

export function normalizeUuidList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
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
  const match = /\/(\d+)$/.exec(value.trim());
  if (!match) return null;
  const total = Number(match[1]);
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}
