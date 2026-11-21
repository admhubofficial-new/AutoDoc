export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function json(
  data: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");

  return new Response(JSON.stringify(data), { status, headers });
}

export async function readJson<T extends Record<string, unknown>>(
  request: Request,
  maxBytes = 8_192,
): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Permintaan harus menggunakan JSON.");
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new HttpError(413, "Ukuran permintaan terlalu besar.");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new HttpError(413, "Ukuran permintaan terlalu besar.");
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Objek JSON diperlukan.");
    }
    return parsed as T;
  } catch {
    throw new HttpError(400, "Format permintaan tidak valid.");
  }
}

export function methodNotAllowed(allowed: string): Response {
  return json({ message: "Metode permintaan tidak didukung." }, 405, {
    Allow: allowed,
  });
}

export function publicError(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ message: error.message }, error.status);
  }
  // Log only server-side diagnostics; never return SQL or secret details.
  console.error("AutoDoc API error:", error instanceof Error ? error.message : "unknown");
  return json({ message: "Terjadi kesalahan pada server. Silakan coba kembali." }, 500);
}
