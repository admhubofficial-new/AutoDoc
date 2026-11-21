type Filters = Record<string, string>;

export class SupabaseApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "SupabaseApiError";
  }
}

function configuration(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Konfigurasi Supabase server belum lengkap.");
  }
  return { url: url.replace(/\/+$/, ""), key };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = configuration();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", "Bearer " + key);
  headers.set("Accept", "application/json");
  headers.set("Cache-Control", "no-store");
  if (init.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(url + "/rest/v1/" + path, {
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
    const payload =
      data && typeof data === "object"
        ? (data as { message?: string; code?: string })
        : {};
    throw new SupabaseApiError(
      payload.message ?? "Supabase request failed.",
      response.status,
      payload.code,
    );
  }

  return data as T;
}

export async function selectOne<T>(
  table: string,
  columns: string,
  filters: Filters,
): Promise<T | null> {
  const query = new URLSearchParams({ select: columns, ...filters, limit: "1" });
  const rows = await request<T[]>(table + "?" + query.toString());
  return rows[0] ?? null;
}

export async function insertRow(
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  await request<unknown>(table, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
}

export async function updateRows(
  table: string,
  filters: Filters,
  values: Record<string, unknown>,
): Promise<void> {
  const query = new URLSearchParams(filters);
  await request<unknown>(table + "?" + query.toString(), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(values),
  });
}

export async function deleteRows(
  table: string,
  filters: Filters,
): Promise<void> {
  const query = new URLSearchParams(filters);
  await request<unknown>(table + "?" + query.toString(), {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function rpc<T>(
  functionName: string,
  args: Record<string, unknown>,
): Promise<T> {
  return request<T>("rpc/" + encodeURIComponent(functionName), {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(args),
  });
}
