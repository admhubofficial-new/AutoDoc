import type { Request } from "undici";

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET belum diisi atau terlalu pendek.");
  }
  return secret;
}

export function sameOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const configuredOrigin = process.env.APP_ORIGIN;
  if (!configuredOrigin) return false;

  try {
    return new URL(origin).origin === new URL(configuredOrigin).origin;
  } catch {
    return false;
  }
}

export function secureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  return (
    process.env.NODE_ENV === "production" ||
    new URL(request.url).protocol === "https:" ||
    forwardedProto?.split(",")[0]?.trim() === "https"
  );
}
