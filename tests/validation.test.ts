import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidClockTime,
  isValidIsoDate,
  normalizeUuidList,
  parseNonNegativeInteger,
  parseContentRangeTotal,
  readBoundedJson,
  RequestBodyError,
  parseRetryAfterSeconds,
  fetchResponseTextWithTimeout,
  RequestTimeoutError,
} from "../supabase/functions/autodoc-auth/validation.ts";

test("date validation accepts real ISO calendar dates and rejects impossible dates", () => {
  assert.equal(isValidIsoDate("2024-02-29"), true);
  assert.equal(isValidIsoDate("2026-11-21"), true);
  assert.equal(isValidIsoDate("2025-02-29"), false);
  assert.equal(isValidIsoDate("2026-13-01"), false);
  assert.equal(isValidIsoDate("21-11-2026"), false);
  assert.equal(isValidIsoDate(null), false);
});

test("time validation accepts HH:MM and HH:MM:SS only", () => {
  assert.equal(isValidClockTime("00:00"), true);
  assert.equal(isValidClockTime("23:59"), true);
  assert.equal(isValidClockTime("12:30:59"), true);
  assert.equal(isValidClockTime("24:00"), false);
  assert.equal(isValidClockTime("12:60"), false);
  assert.equal(isValidClockTime("9:30"), false);
});

test("non-negative integer parsing uses fallbacks and rejects unsafe values", () => {
  assert.equal(parseNonNegativeInteger("", 100), 100);
  assert.equal(parseNonNegativeInteger(null, 0), 0);
  assert.equal(parseNonNegativeInteger(" 12 ", 0), 12);
  assert.equal(parseNonNegativeInteger(0), 0);
  assert.equal(parseNonNegativeInteger(-1), null);
  assert.equal(parseNonNegativeInteger(1.5), null);
  assert.equal(parseNonNegativeInteger(true), null);
  assert.equal(parseNonNegativeInteger("abc"), null);
  assert.equal(parseNonNegativeInteger(Number.MAX_SAFE_INTEGER + 1), null);
});

test("UUID recipient lists validate shape, enforce a maximum, and de-duplicate IDs", () => {
  const a = "550e8400-e29b-41d4-a716-446655440000";
  const b = "550e8400-e29b-41d4-a716-446655440001";
  assert.deepEqual(normalizeUuidList([a, b, a]), [a, b]);
  assert.equal(normalizeUuidList([]), null);
  assert.equal(normalizeUuidList(["not-a-uuid"]), null);
  assert.equal(normalizeUuidList([a, 1]), null);
  assert.equal(normalizeUuidList(Array(101).fill(a)), null);
  assert.equal(normalizeUuidList(Array(60).fill(a), 60)?.length, 1);
  assert.equal(normalizeUuidList(Array(61).fill(a), 60), null);
});


test("PostgREST exact content range totals are parsed safely", () => {
  assert.equal(parseContentRangeTotal("0-0/17"), 17);
  assert.equal(parseContentRangeTotal("*/0"), 0);
  assert.equal(parseContentRangeTotal("0-0/0"), 0);
  assert.equal(parseContentRangeTotal(null), null);
  assert.equal(parseContentRangeTotal("items 0-0/17"), null);
  assert.equal(parseContentRangeTotal("0-0/*"), null);
  assert.equal(parseContentRangeTotal("0-0/-1"), null);
});


function streamedRequest(chunks: Uint8Array[], onCancel?: () => void): Request {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
    cancel() { onCancel?.(); },
  });
  return new Request("https://autodoc.test/request", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
}

test("bounded JSON reader accepts valid object bodies without relying on Content-Length", async () => {
  const request = new Request("https://autodoc.test/request", {
    method: "POST",
    body: JSON.stringify({ tanggal: "2026-11-24", recipient_ids: ["one"] }),
  });
  assert.deepEqual(await readBoundedJson(request, 256), {
    tanggal: "2026-11-24",
    recipient_ids: ["one"],
  });
});

test("bounded JSON reader cancels a stream as soon as its byte limit is exceeded", async () => {
  let cancelled = false;
  const request = streamedRequest(
    [new TextEncoder().encode('{"data":"1234567890"}'), new TextEncoder().encode("ignored")],
    () => { cancelled = true; },
  );
  await assert.rejects(
    readBoundedJson(request, 12),
    (error: unknown) => error instanceof RequestBodyError && error.status === 413,
  );
  assert.equal(cancelled, true);
});

test("bounded JSON reader rejects malformed JSON, arrays, and non-object payloads", async () => {
  for (const value of ["{", "[]", '"text"', "null"]) {
    const request = new Request("https://autodoc.test/request", { method: "POST", body: value });
    await assert.rejects(
      readBoundedJson(request, 128),
      (error: unknown) => error instanceof RequestBodyError && error.status === 400,
    );
  }
});

test("1 MiB document body limit accommodates 100 recipients with eight maximum-length menu components", async () => {
  const recipientIds = Array.from({ length: 100 }, (_, index) =>
    "00000000-0000-4000-8000-" + String(index + 1).padStart(12, "0")
  );
  const longComponent = "\u0001".repeat(180);
  const recipientMenuItems = Object.fromEntries(
    recipientIds.map((id) => [id, Array(8).fill(longComponent)]),
  );
  const raw = JSON.stringify({
    tanggal: "2026-11-24",
    recipient_ids: recipientIds,
    menu_items: Array(8).fill("Menu"),
    recipient_menu_items: recipientMenuItems,
  });
  assert.ok(new TextEncoder().encode(raw).byteLength < 1024 * 1024);
  const request = new Request("https://autodoc.test/docs/create", { method: "POST", body: raw });
  const parsed = await readBoundedJson(request, 1024 * 1024);
  assert.equal((parsed.recipient_ids as string[]).length, 100);
  assert.equal(Object.keys(parsed.recipient_menu_items as Record<string, unknown>).length, 100);
});

test("Retry-After parsing accepts seconds and HTTP dates but clamps unreasonable delays", () => {
  const now = Date.UTC(2026, 10, 24, 0, 0, 0);
  assert.equal(parseRetryAfterSeconds("12", now), 12);
  assert.equal(parseRetryAfterSeconds("0", now), 0);
  assert.equal(parseRetryAfterSeconds(new Date(now + 5000).toUTCString(), now), 5);
  assert.equal(parseRetryAfterSeconds(new Date(now - 5000).toUTCString(), now), 0);
  assert.equal(parseRetryAfterSeconds("not-a-delay", now), null);
  assert.equal(parseRetryAfterSeconds("999999", now, 3600), 3600);
});

test("OpenAI fetch deadline aborts a provider request that does not respond", async () => {
  let aborted = false;
  const pendingFetch: typeof fetch = (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      aborted = true;
      reject(new Error("aborted"));
    }, { once: true });
  });
  await assert.rejects(
    fetchResponseTextWithTimeout("https://provider.test/responses", { method: "POST" }, 10, pendingFetch),
    RequestTimeoutError,
  );
  assert.equal(aborted, true);
});


test("OpenAI fetch deadline remains active while reading a stalled response body", async () => {
  let bodyAborted = false;
  const pendingBodyFetch: typeof fetch = (_input, init) => Promise.resolve(
    new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        init?.signal?.addEventListener("abort", () => {
          bodyAborted = true;
          controller.error(new Error("body aborted"));
        }, { once: true });
      },
    })),
  );
  await assert.rejects(
    fetchResponseTextWithTimeout("https://provider.test/responses", { method: "POST" }, 10, pendingBodyFetch),
    RequestTimeoutError,
  );
  assert.equal(bodyAborted, true);
});

test("bounded JSON reader rejects an oversized declared body before reading the stream", async () => {
  const request = new Request("https://autodoc.test/request", {
    method: "POST",
    headers: { "content-length": "1024" },
    body: "{}",
  });
  await assert.rejects(
    readBoundedJson(request, 64),
    (error: unknown) => error instanceof RequestBodyError && error.status === 413,
  );
});
