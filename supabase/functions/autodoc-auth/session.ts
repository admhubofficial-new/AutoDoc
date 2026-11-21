export interface SessionPayload {
  v: number;
  iat: number;
  exp: number;
  nonce: string;
}

const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function signSessionPayload(
  payload: SessionPayload,
  key: CryptoKey,
): Promise<string> {
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(encoded)),
  );
  return encoded + "." + toBase64Url(signature);
}

export async function verifySessionPayload(
  token: string,
  key: CryptoKey,
  nowSeconds: number,
  ttlSeconds: number,
): Promise<SessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  try {
    const signature = fromBase64Url(parts[1]);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature.buffer as ArrayBuffer,
      encoder.encode(parts[0]),
    );
    if (!valid) return null;

    const value: unknown = JSON.parse(
      new TextDecoder().decode(fromBase64Url(parts[0])),
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const payload = value as Partial<SessionPayload>;

    if (
      !Number.isSafeInteger(payload.v) ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp) ||
      typeof payload.nonce !== "string" ||
      payload.nonce.length < 16 ||
      (payload.iat as number) > nowSeconds + 60 ||
      (payload.exp as number) <= nowSeconds ||
      (payload.exp as number) - (payload.iat as number) > ttlSeconds ||
      (payload.exp as number) <= (payload.iat as number)
    ) return null;

    return payload as SessionPayload;
  } catch {
    return null;
  }
}
