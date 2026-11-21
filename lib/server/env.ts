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

  let requestOrigin: string;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  const allowedOrigins = new Set<string>();
  const configuredOrigin = process.env.APP_ORIGIN;
  if (configuredOrigin) {
    try {
      allowedOrigins.add(new URL(configuredOrigin).origin);
    } catch {
      // A malformed configured origin never broadens access.
    }
  }

  // Permit this exact Vercel deployment host for preview builds, while
  // keeping production/custom origins explicitly configured via APP_ORIGIN.
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    if (!host) continue;
    try {
      allowedOrigins.add(new URL("https://" + host).origin);
    } catch {
      // Ignore malformed platform-provided host values.
    }
  }

  return allowedOrigins.has(requestOrigin);
}

export function secureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  return (
    process.env.NODE_ENV === "production" ||
    new URL(request.url).protocol === "https:" ||
    forwardedProto?.split(",")[0]?.trim() === "https"
  );
}
