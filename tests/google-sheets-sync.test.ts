import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { readFileSync } from "node:fs";

const edge = readFileSync(new URL("../supabase/functions/autodoc-auth/index.ts", import.meta.url), "utf8");
const master = readFileSync(new URL("../master.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../google-sheets-sync.js", import.meta.url), "utf8");
const script = readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("Google Apps Script and frontend modules are valid JavaScript source", () => {
  assert.doesNotThrow(() => new Script(script));
  assert.doesNotThrow(() => new Script(ui));
});

test("Apps Script authenticates every operation with a private script property", () => {
  assert.match(script, /getScriptProperties\(\)\.getProperty\("AUTODOC_WEBHOOK_SECRET"\)/);
  assert.match(script, /constantTimeEquals_\(expected, supplied\)/);
  assert.match(script, /case "readRecipients"/);
  assert.match(script, /case "writeRecipients"/);
  assert.doesNotMatch(script, /doGet\s*\(/);
});

test("Google Sheets export writes only to the guarded AutoDoc-managed tab", () => {
  assert.match(script, /const MANAGED_SHEET_NAME = "AutoDoc_Penerima"/);
  assert.match(script, /if \(marker !== MANAGED_MARKER\)/);
  assert.match(script, /sheet\.clearContents\(\)/);
  assert.match(script, /getSheetById\(SOURCE_SHEET_GID\)/);
  assert.match(script, /MAX_ROWS = 5000/);
});

test("Sheets preview is read-only and protected by an active AutoDoc session", () => {
  const start = edge.indexOf("async function handleSheetsPreview(");
  const end = edge.indexOf("async function handleSheetsApply(", start);
  assert.ok(start >= 0 && end > start);
  const body = edge.slice(start, end);
  assert.match(body, /validSession\(request\)/);
  assert.match(body, /buildSheetsPreview\(\)/);
  assert.doesNotMatch(body, /supabaseRequest[\s\S]*method:\s*"(POST|PATCH|DELETE)"/);
});

test("Sheets import requires explicit selected row numbers and recalculates the preview server-side", () => {
  const start = edge.indexOf("async function handleSheetsApply(");
  const end = edge.indexOf("async function handleSheetsPush(", start);
  assert.ok(start >= 0 && end > start);
  const body = edge.slice(start, end);
  assert.match(body, /validSession\(request\)/);
  assert.match(body, /body\.row_numbers/);
  assert.match(body, /buildSheetsPreview\(\)/);
  assert.match(body, /row\.can_apply === true/);
  assert.match(body, /on_conflict: "kelompok,nama"/);
});

test("Sheets export requires explicit confirmation and never exposes the webhook secret to the frontend", () => {
  const start = edge.indexOf("async function handleSheetsPush(");
  const end = edge.indexOf("Deno.serve(", start);
  assert.ok(start >= 0 && end > start);
  const body = edge.slice(start, end);
  assert.match(body, /validSession\(request\)/);
  assert.match(body, /body\.confirm !== true/);
  assert.match(body, /recipient_id: row\.id/);
  assert.match(edge, /getEnv\("GOOGLE_SHEETS_WEBHOOK_SECRET"\)/);
  assert.doesNotMatch(ui + master + index, /GOOGLE_SHEETS_WEBHOOK_SECRET\s*[:=]\s*["'][^"']+["']/);
});

test("Google Sheets tab stays inside Data Master without adding duplicate primary navigation", () => {
  assert.match(master, /"Google Sheets"/);
  assert.match(master, /window\.AutoDocSheetsSync\.render\(formSlot,message,api\)/);
  assert.match(index, /google-sheets-sync\.js/);
  assert.doesNotMatch(index, /data-home-nav="sheets"/);
});

test("new recipients from Sheets are held for review unless every beneficiary count is explicit", () => {
  assert.match(edge, /penerima baru/);
  for (const field of ["siswa_kecil", "siswa_besar", "tendik", "ibu_hamil", "ibu_menyusui", "balita", "putus_sekolah", "kader"]) {
    assert.match(edge, new RegExp('SHEETS_COUNT_FIELDS'));
    assert.match(edge, new RegExp(field));
  }
});
