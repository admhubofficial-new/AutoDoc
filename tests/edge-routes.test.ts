import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../supabase/functions/autodoc-auth/index.ts", import.meta.url), "utf8");

function functionBody(name: string, nextName: string): string {
  const start = source.indexOf("async function " + name + "(");
  const end = source.indexOf("function " + nextName + "(", start + 1);
  assert.ok(start >= 0 && end > start, "expected backend handler boundaries");
  return source.slice(start, end);
}

test("document creation requires a valid session and does not request a second PIN", () => {
  const body = functionBody("handleDocsCreate", "handleDocsDays");
  assert.match(body, /validSession\(request\)/);
  assert.doesNotMatch(body, /verifyMutationPin/);
  assert.match(source, /case "docs\/create": return await handleDocsCreate\(request\)/);
});

test("BAST realization retains a second PIN confirmation", () => {
  const body = functionBody("handleDocsRealization", "lockResponse");
  assert.match(body, /verifyMutationPin\(request, body\.token, "realisasi_bast"\)/);
});

test("master imports remain bounded and use a conflict-safe upsert key", () => {
  const body = functionBody("handleMasterImport", "verifyMutationPin");
  assert.match(body, /body\.rows\.length > 500/);
  assert.match(body, /on_conflict: "kelompok,nama"/);
});


test("dashboard endpoint is protected by an active session and reads aggregate counts", () => {
  const body = functionBody("handleDashboardSummary", "handleDocsCreate");
  assert.match(body, /validSession\(request\)/);
  assert.match(body, /countRows\("documents"/);
  assert.match(body, /recent_distributions/);
});

test("retries cannot overwrite an issued distribution snapshot", () => {
  const body = functionBody("handleDocsCreate", "handleDocsDays");
  assert.match(body, /error\.code === "55000"/);
  assert.match(body, /new AppError\(\s*409/);
  assert.match(body, /snapshot dokumen lama tidak berubah/);
});
