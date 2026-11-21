import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../documents.js", import.meta.url), "utf8");

test("document issuance does not reference the removed print PIN", () => {
  assert.doesNotMatch(source, /^\s*token\s*$/m);
  assert.match(source, /recipient_ids:selected/);
});

test("status reporting recreates its live region if the modal markup is missing it", () => {
  assert.match(source, /if\(!el\)\s*\{[\s\S]*?el=node\("p","docs-msg"\)/);
});

test("partial document creation responses are handled as valid API results", () => {
  assert.match(source, /response\.status!==207/);
});


test("printed documents use the public BGN logo in the letterhead", () => {
  assert.match(source, /const LETTERHEAD_LOGO_URL="https:\/\/cnbomblvtddkmtojzpyd\.supabase\.co\/storage\/v1\/object\/public\/logo%20bgn\/logo-bgn%20\(1\)\.png"/);
  assert.match(source, /class='top-logo' src='/);
});

test("printed status waits for all letterhead assets and follows the print dialog", () => {
  assert.match(source, /const logos=Array\.from\(win\.document\.querySelectorAll\("\.top-logo"\)\)/);
  assert.match(source, /logo\.addEventListener\("load",resolve/);
  assert.match(source, /logo\.addEventListener\("error",resolve/);
  assert.match(source, /Promise\.all\(logos\.map\(imageReady\)\)/);
  assert.match(source, /try\{win\.focus\(\);win\.print\(\)\}catch\(_\)\{return\}[\s\S]*?api\("docs\/mark-printed"/);
});


test("creation trusts the session-protected endpoint that already filters active recipients", () => {
  assert.ok(source.includes('api("master/recipients")'));
  assert.ok(source.includes("const recipients=Array.isArray(master.recipients)?master.recipients:[]"));
  assert.ok(!source.includes("master.recipients).filter(isActiveRecipient"));
});

test("wizard offers SJ and BAST selected by default and requires a numbered document", () => {
  assert.match(source, /id='docsKindSj' type='checkbox' checked/);
  assert.match(source, /id='docsKindBast' type='checkbox' checked/);
  assert.match(source, /function selectedDocumentKinds\(\)/);
  assert.match(source, /Pilih minimal Surat Jalan atau BAST/);
});

test("daily menu supports eight ordered components, suggestions, reordering, and removal", () => {
  assert.match(source, /menuComponents\.length>=8/);
  assert.match(source, /docsMenuSuggestions/);
  assert.match(source, /Geser .* ke atas/);
  assert.match(source, /Geser .* ke bawah/);
  assert.match(source, /Hapus komponen/);
  assert.match(source, /function readMenuComponents\(\)/);
  assert.match(source, /docsAddMenuItem/);
});

test("wizard can copy the ordered menu from the latest distribution archive", () => {
  assert.match(source, /function copyLastMenu\(\)/);
  assert.match(source, /api\("docs\/days\?offset=0"\)/);
  assert.match(source, /api\("docs\/list\?tanggal="/);
  assert.match(source, /distribution\.menu_items/);
  assert.match(source, /Salin dari distribusi terakhir/);
});

test("creation sends menu components, meal time, and only selected numbered document types", () => {
  assert.match(source, /menu_items:menuItems/);
  assert.match(source, /waktu_makan:\$\("#docsMealTime",modal\)\.value/);
  assert.match(source, /jenis_dokumen:kinds/);
  assert.match(source, /const values=\{[\s\S]*?"Jumlah dokumen bernomor":selected\.length\*kinds\.length/);
  assert.doesNotMatch(source, /menu:\$\("#docsMenu",modal\)\.value/);
});

test("meal time supports pagi, siang, and sore with siang selected by default", () => {
  assert.match(source, /id='docsMealTime'><option value='pagi'>Pagi<\/option><option value='siang' selected>Siang<\/option><option value='sore'>Sore<\/option>/);
});
