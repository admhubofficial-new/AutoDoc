import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../supabase/functions/autodoc-auth/index.ts", import.meta.url), "utf8");
const documentsUi = readFileSync(new URL("../documents.js", import.meta.url), "utf8");
const masterUi = readFileSync(new URL("../master.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const dashboardUi = readFileSync(new URL("../dashboard.js", import.meta.url), "utf8");

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
  assert.match(body, /bast_pending: bastPendingCount/);
  assert.match(body, /status: "in\.\(dibuat,dicetak,ditandatangani\)"/);
});

test("retries cannot overwrite an issued distribution snapshot", () => {
  const body = functionBody("handleDocsCreate", "handleDocsDays");
  assert.match(body, /error\.code === "55000"/);
  assert.match(body, /new AppError\(\s*409/);
  assert.match(body, /snapshot dokumen lama tidak berubah/);
});


test("distribution archive endpoint requires a valid session and reads only recent distributions", () => {
  const body = functionBody("handleDocsDays", "handleDocsList");
  assert.match(body, /validSession\(request\)/);
  assert.match(body, /order: "tanggal\.desc"/);
  assert.match(body, /limit: "61"/);
  assert.match(body, /rawOffset/);
  assert.match(body, /offset: String\(offset\)/);
  assert.match(body, /has_more: rows.length > 60/);
  assert.match(source, /case "docs\/days": return await handleDocsDays\(request\)/);
});

test("document creation uses a guided flow and recipients are explicitly selected", () => {
  assert.match(documentsUi, /data-wizard-step='1'/);
  assert.match(documentsUi, /function goWizardStep\(step\)/);
  assert.match(documentsUi, /docsReviewSummary/);
  assert.match(documentsUi, /check\.checked=false/);
  assert.match(documentsUi, /Pilih minimal satu penerima/);
});

test("archive provides searchable distribution days, recipient pairs, and bulk print actions", () => {
  assert.match(documentsUi, /api\("docs\/days"\)/);
  assert.match(documentsUi, /docsDaysSearch/);
  assert.match(documentsUi, /docs\/days\?offset=/);
  assert.match(documentsUi, /docsDaysPrevious/);
  assert.match(documentsUi, /docsDaysNext/);
  assert.match(documentsUi, /function renderDocumentGroup/);
  assert.match(documentsUi, /function printDocuments/);
  assert.match(documentsUi, /docsPrintSj/);
  assert.match(documentsUi, /docsPrintBast/);
});

test("navigation opens document and master modules through public module APIs, not hidden launchers", () => {
  assert.match(indexHtml, /Buat Dokumen/);
  assert.match(indexHtml, /window\.AutoDocDocuments\.open\(\)/);
  assert.match(indexHtml, /window\.AutoDocMaster\?\.open\("recipients"\)/);
  assert.doesNotMatch(indexHtml, /id="docsLauncher"/);
  assert.match(documentsUi, /window\.AutoDocDocuments=Object\.freeze/);
  assert.match(masterUi, /window\.AutoDocMaster=Object\.freeze/);
  assert.match(masterUi, /placeholder="Cari data pada bagian ini/);
});

test("dashboard completion shortcuts open the matching Data Master section", () => {
  assert.match(dashboardUi, /window\.AutoDocMaster\?\.open\(warning\.entity, warning\.query\)/);
  assert.match(dashboardUi, /entity: "settings"/);
  assert.match(dashboardUi, /entity: "vehicles"/);
  assert.match(dashboardUi, /entity: "recipients"/);
  assert.match(dashboardUi, /query: "alamat belum dilengkapi"/);
  assert.match(dashboardUi, /query: "perlu verifikasi"/);
  assert.match(masterUi, /alamat kosong alamat belum dilengkapi/);
});


test("inline application script remains syntactically valid", () => {
  const scripts = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0, "expected an inline application script");
  scripts.forEach(match => new Script(match[1]));
});
