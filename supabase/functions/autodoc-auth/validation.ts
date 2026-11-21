export const TOKEN_MIN_LENGTH = 6;
export const TOKEN_MAX_LENGTH = 128;

export function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return token.length >= TOKEN_MIN_LENGTH && token.length <= TOKEN_MAX_LENGTH
    ? token
    : null;
}
