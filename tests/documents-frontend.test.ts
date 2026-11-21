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

test("printed status is recorded only after an explicit user confirmation", () => {
  assert.match(source, /const logos=Array\.from\(win\.document\.querySelectorAll\("\.top-logo"\)\)/);
  assert.match(source, /logo\.addEventListener\("load",resolve/);
  assert.match(source, /logo\.addEventListener\("error",resolve/);
  assert.match(source, /Promise\.all\(logos\.map\(imageReady\)\)/);
  assert.match(source, /const markButton=win\.document\.createElement\("button"\)/);
  assert.match(source, /Konfirmasi sudah dicetak/);
  assert.match(source, /markButton\.addEventListener\("click",async\(\)=>\{/);
  assert.match(source, /api\("docs\/mark-printed"/);
  assert.doesNotMatch(source, /try\{win\.focus\(\);win\.print\(\)\}catch\(_\)\{return\}[\s\S]*?api\("docs\/mark-printed"/);
});


test("creation trusts the session-protected endpoint that already filters active recipients", () => {
  assert.ok(source.includes('api("master/recipients")'));
  assert.ok(source.includes('api("master/list?include_recipients=false")'));
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

test("organoleptic printing matches the approved A4 portrait template", () => {
  assert.match(source, /FORMULIR UJI ORGANOLEPTIK/);
  assert.match(source, /@page\{size:A4 portrait;margin:0\}/);
  assert.match(source, /break-after:page/);
  assert.match(source, /function organolepticSheet/);
  assert.match(source, /function organolepticTable/);
  for (const aspect of ["Aroma", "Suhu", "Penampilan", "Citarasa", "Tekstur"]) assert.match(source, new RegExp(aspect));
});

test("organoleptic checkboxes and handwritten fields stay blank", () => {
  assert.match(source, /for\(let i=0;i<10;i\+\+\)row\.append\(doc\.createElement\("td"\)\)/);
  assert.match(source, /organolepticElement\(doc,"div","followup","Tindak Lanjut:"\)/);
  assert.match(source, /organolepticElement\(doc,"div","dots"\)/);
});

test("organoleptic forms use distribution snapshots and five blank menu rows", () => {
  assert.match(source, /currentDistribution\.nama_ahli_gizi/);
  assert.match(source, /currentDistribution\.waktu_makan/);
  assert.match(source, /currentDistribution\.menu_items/);
  assert.match(source, /Array\(5\)\.fill\(""\)/);
  assert.match(source, /Nama Posyandu/);
  assert.match(source, /Nama Sekolah/);
});

test("organoleptic output is available in bulk, per recipient, and from wizard print selection", () => {
  assert.match(source, /docsPrintOrganoleptic/);
  assert.match(source, /Cetak Uji Organoleptik/);
  assert.match(source, /Semua Uji Organoleptik/);
  assert.match(source, /docsIncludeOrganoleptic/);
  assert.match(source, /Formulir uji organoleptik/);
  assert.match(source, /getRecipientsByIds/);
});

test("organoleptic printing does not create or update numbered documents", () => {
  const body = source.slice(source.indexOf("function printOrganolepticForms"), source.indexOf("function showRealization"));
  assert.doesNotMatch(body, /api\(/);
  assert.doesNotMatch(body, /docs\/create|mark-printed|counters/);
});

test("organoleptic user data is inserted with textContent rather than HTML interpolation", () => {
  const body = source.slice(source.indexOf("function organolepticElement"), source.indexOf("function showRealization"));
  assert.ok(body.includes('element.textContent=String(text??"")'));
  assert.doesNotMatch(body, /innerHTML|insertAdjacentHTML/);
});

test("printed Surat Jalan has three role-specific signatories", () => {
  assert.match(source, /Yang Menyerahkan/);
  assert.match(source, /Petugas Distribusi SPPG/);
  assert.match(source, /Pengemudi/);
  assert.match(source, /Yang Menerima/);
  assert.match(source, /sign-name/);
  assert.match(source, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("printed BAST includes Kepala SPPI from the immutable SPPG snapshot", () => {
  assert.match(source, /sppg\.nama_kepala_sppi/);
  assert.match(source, /Mengetahui,/);
  assert.match(source, /Kepala SPPI/);
  assert.match(source, /const signatures=isBast/);
  assert.match(source, /esc\(dist\.nama_petugas\|\|""\)/);
});

test("archive global search and bulk deletion use explicit page selection and require a PIN", () => {
  assert.match(source, /async function loadDistributions/);
  assert.match(source, /api\("docs\/days"\+query\)/);
  assert.match(source, /docsDaysSelectAll/);
  assert.match(source, /Pilih semua pada halaman ini/);
  assert.match(source, /selectedIds\.add/);
  assert.match(source, /docsDaysDelete/);
  assert.match(source, /docsDeletePin/);
  assert.match(source, /api\("docs\/delete-history"/);
  assert.match(source, /distribution_ids:ids/);
  assert.match(source, /const token=pin\.value/);
});
