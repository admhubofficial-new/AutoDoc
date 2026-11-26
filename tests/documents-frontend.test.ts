import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../documents.js", import.meta.url), "utf8");
const organolepticSource = readFileSync(new URL("../organoleptic-print.js", import.meta.url), "utf8");
const printRendererSource = readFileSync(new URL("../documents-print.js", import.meta.url), "utf8");
const archiveSource = readFileSync(new URL("../archive.js", import.meta.url), "utf8");
const realizationSource = readFileSync(new URL("../bast-realization.js", import.meta.url), "utf8");
const previewSource = readFileSync(new URL("../document-preview.js", import.meta.url), "utf8");
const menuSource = readFileSync(new URL("../document-menu.js", import.meta.url), "utf8");
const htmlSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const masterSource = readFileSync(new URL("../master.js", import.meta.url), "utf8");

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
  assert.match(printRendererSource, /class='top-logo' src='/);
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

test("single-page creation keeps SJ and BAST selected by default without wizard steps", () => {
  assert.match(source, /id='docsKindSj' type='checkbox' checked/);
  assert.match(source, /id='docsKindBast' type='checkbox' checked/);
  assert.match(source, /function selectedDocumentKinds\(\)/);
  assert.match(source, /docs-create-layout/);
  assert.doesNotMatch(source, /docs-wizard-steps|data-step-pane|goWizardStep/);
  assert.match(source, /Pilih minimal Surat Jalan atau BAST/);
});

test("live print preview uses the production renderer and follows form changes", () => {
  assert.match(previewSource, /function updateLivePreview\(\)/);
  assert.match(previewSource, /window\.AutoDocPrintRenderer/);
  assert.match(previewSource, /frame\.srcdoc=html/);
  assert.match(source, /form\.addEventListener\("input",\(\)=>\{formDirty=true;syncPreflightSummary\(\);previewController\?\.updateLivePreview\(\)\}\)/);
  assert.match(source, /form\.addEventListener\("change",\(\)=>\{formDirty=true;syncPreflightSummary\(\);previewController\?\.updateLivePreview\(\)\}\)/);
  assert.match(previewSource, /Memuat nomor surat/);
  assert.match(previewSource, /previewPortionRows/);
  assert.match(previewSource, /renderOrganolepticPreview/);
  assert.match(source, /value='ORGANOLEPTIC'/);
  assert.match(previewSource, /docsPreviewPages/);
});

test("daily menu supports eight ordered components, suggestions, reordering, and removal", () => {
  assert.match(menuSource, /items\.length\s*>=\s*8/);
  assert.match(source, /docsMenuSuggestions/);
  assert.match(menuSource, /Geser .* ke atas/);
  assert.match(menuSource, /Geser .* ke bawah/);
  assert.match(menuSource, /Hapus komponen/);
  assert.match(source, /function readMenuComponents\(\)/);
  assert.match(source, /docsAddMenuItem/);
});

test("single-page form can copy the ordered menu from the latest distribution archive", () => {
  assert.match(source, /function copyLastMenu\(\)/);
  assert.match(source, /api\("docs\/days\?offset=0"\)/);
  assert.match(source, /api\("docs\/list\?tanggal="/);
  assert.match(source, /distribution\.menu_items/);
  assert.match(source, /Salin menu terakhir/);
});


test("petugas, pengemudi, dan kendaraan remain optional during document creation", () => {
  assert.ok(source.includes("label for='docsStaff'>Petugas</label>"));
  assert.ok(source.includes("label for='docsDriver'>Pengemudi</label>"));
  assert.ok(source.includes("label for='docsVehicle'>Kendaraan</label>"));
  assert.doesNotMatch(source, /id='docsStaff'[^>]*required/);
  assert.doesNotMatch(source, /id='docsDriver'[^>]*required/);
  assert.doesNotMatch(source, /id='docsVehicle'[^>]*required/);
  assert.doesNotMatch(source, /Petugas, pengemudi, dan kendaraan wajib diisi/);
  assert.match(source, /nama_petugas:/);
  assert.match(source, /nama_pengemudi:/);
  assert.match(source, /no_kendaraan:/);
});

test("creation sends menu components, meal time, and only selected numbered document types", () => {
  assert.match(source, /menu_items:menuItems/);
  assert.match(source, /waktu_makan:\$\("#docsMealTime",modal\)\.value/);
  assert.match(source, /jenis_dokumen:kinds/);
  assert.match(source, /recipient_ids:selected/);
  assert.match(source, /const body=\{/);
  assert.doesNotMatch(source, /menu:\$\("#docsMenu",modal\)\.value/);
});

test("meal time supports pagi, siang, and sore with siang selected by default", () => {
  assert.match(source, /id='docsMealTime'><option value='pagi'>Pagi<\/option><option value='siang' selected>Siang<\/option><option value='sore'>Sore<\/option>/);
});

test("organoleptic printing matches the approved A4 portrait template", () => {
  assert.match(organolepticSource, /FORMULIR UJI ORGANOLEPTIK/);
  assert.match(organolepticSource, /@page\{size:A4 portrait;margin:0\}/);
  assert.match(organolepticSource, /break-after:page/);
  assert.match(organolepticSource, /function organolepticSheet/);
  assert.match(organolepticSource, /function organolepticTable/);
  for (const aspect of ["Aroma", "Suhu", "Penampilan", "Citarasa", "Tekstur"]) assert.match(organolepticSource, new RegExp(aspect));
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
  assert.ok(organolepticSource.includes('element.textContent=String(text??"")'));
  assert.doesNotMatch(organolepticSource, /innerHTML|insertAdjacentHTML/);
});



test("BAST realization form is isolated in its module and preserves validation and PIN confirmation", () => {
  assert.match(realizationSource, /function showRealization\(card,\s*doc\)/);
  assert.match(realizationSource, /labelText \+ " diterima \*"/);
  assert.match(realizationSource, /deliveredSmall/);
  assert.match(realizationSource, /deliveredLarge/);
  assert.match(realizationSource, /addField\("PIN akses untuk konfirmasi \*", "token", "password"/);
  assert.match(realizationSource, /api\("docs\/realization",\s*data\)/);
  assert.match(realizationSource, /data\.document_id\s*=\s*doc\.id/);
  assert.match(source, /realizationController\.showRealization/);
  assert.match(source, /window\.AutoDocBastRealization\.create/);
});

test("archive module owns global search, page selection, and PIN-protected bulk deletion", () => {
  assert.match(archiveSource, /async function loadDistributions/);
  assert.match(archiveSource, /api\("docs\/days"\s*\+\s*query\)/);
  assert.match(archiveSource, /requestSequence\+\+|\+\+requestSequence/);
  assert.match(archiveSource, /if\s*\(requestId\s*!==\s*requestSequence\)\s*return/);
  assert.match(archiveSource, /docsDaysSelectAll/);
  assert.match(archiveSource, /Pilih semua pada halaman ini/);
  assert.match(archiveSource, /selectedIds\.add/);
  assert.match(archiveSource, /selectedIds\.size\s*<\s*60/);
  assert.match(archiveSource, /docsDaysDelete/);
  assert.match(archiveSource, /docsDeletePin/);
  assert.match(archiveSource, /api\("docs\/delete-history"/);
  assert.match(archiveSource, /distribution_ids:\s*ids/);
  assert.match(archiveSource, /const token\s*=\s*pin\.value/);
  assert.match(source, /archiveController\.loadDistributions/);
});







test("distribution date defaults to today in WIB and departure time starts empty", () => {
  assert.match(source, /function nowInJakarta\(\)/);
  assert.ok(source.includes('timeZone:"Asia/Jakarta"'));
  assert.match(source, /const today=\(\)=>nowInJakarta\(\);/);
  assert.match(source, /const todayVal=today\(\)/);
  assert.match(source, /<input id='docsTime' type='time'>/);
  assert.doesNotMatch(source, /currentTime\.time|Terisi otomatis mengikuti waktu WIB/);
});


test("creation form accepts new staff, driver and vehicle values and remembers them as master data", () => {
  assert.match(source, /id='docsStaff' type='text' list='docsStaffSuggestions'/);
  assert.match(source, /id='docsDriver' type='text' list='docsDriverSuggestions'/);
  assert.match(source, /id='docsVehicle' type='text' list='docsVehicleSuggestions'/);
  assert.match(source, /async function rememberMasterValue\(entity,field,value\)/);
  assert.match(source, /api\("master\/save",\{entity,data\}\)/);
  assert.match(source, /rememberCreationInputs\(body\)/);
  assert.match(source, /masterSuggestions\(master\.menus,"teks_menu"\)/);
});





test("live document preview is isolated in its own module and initialized before documents", () => {
  assert.match(previewSource, /window\.AutoDocDocumentPreview=Object\.freeze/);
  assert.match(previewSource, /return Object\.freeze\(\{updateLivePreview,fitPreviewFrame\}\)/);
  assert.match(source, /window\.AutoDocDocumentPreview\.create/);
  assert.doesNotMatch(source, /function updateLivePreview|function renderOrganolepticPreview|function fitPreviewFrame/);
});

test("daily menu editor is isolated, capped at eight, and delegates preview refresh", () => {
  assert.match(menuSource, /window\.AutoDocMenuEditor\s*=\s*Object\.freeze/);
  assert.match(menuSource, /items\.length\s*>=\s*8/);
  assert.match(menuSource, /Geser .* ke atas/);
  assert.match(menuSource, /Hapus komponen/);
  assert.match(source, /window\.AutoDocMenuEditor\.create/);
  assert.match(source, /menuController\?\.read\(\)/);
  assert.doesNotMatch(source, /function renderMenuComponents\(\)\s*\{[\s\S]*?docs-menu-row/);
  const menuTag = htmlSource.indexOf('src="./document-menu.js');
  const previewTag = htmlSource.indexOf('src="./document-preview.js');
  const documentsTag = htmlSource.indexOf('src="./documents.js');
  assert.ok(menuTag > previewTag && documentsTag > menuTag);
});





test("archive history supports selecting individual or all documents for batch printing", () => {
  assert.match(source, /id='docsPrintSelectAll'/);
  assert.match(source, /Pilih semua dokumen/);
  assert.match(source, /id='docsPrintSelected'/);
  assert.match(source, /Cetak dipilih/);
  assert.match(source, /data-print-doc-id/);
  assert.match(source, /selectedPrintIds\.add/);
  assert.match(source, /selectedPrintIds\.delete/);
  assert.match(source, /currentDocs\.filter\(doc=>selectedPrintIds\.has\(String\(doc\.id\)\)\)/);
  assert.match(source, /renderDocumentGroup\(group,selectedPrintIds,updatePrintSelection\)/);
  assert.match(source, /\.batch-page-break\{break-before:page/);
  assert.match(source, /docs\/mark-printed/);
});






test("organoleptic meal options remain normal text for manual marking", () => {
  assert.ok(organolepticSource.includes('["Pagi","Siang","Sore"]'));
  assert.ok(organolepticSource.includes('wrap.append(doc.createTextNode(meal))'));
  assert.ok(!organolepticSource.includes('organolepticElement(doc,"s"'));
});





test("organoleptic archive and creation printing use recipient-specific snapshot menu items", () => {
  assert.match(source, /function getArchiveRecipientMenus/);
  assert.match(source, /function printOrganolepticForms\(recipients,menuByRecipient=\{\}\)/);
  assert.match(source, /menuByRecipient\?\.\[recipientId\]/);
  assert.match(source, /pendingOrganolepticPrint\.menuByRecipient/);
  assert.match(source, /printOrganolepticForms\(getArchiveRecipients\(\),getArchiveRecipientMenus\(\)\)/);
});

test("P4 creation form groups the operator flow and keeps readiness in one compact status", () => {
  const steps = [
    "for='docsDate'",
    "class='docs-recipient-subsection'",
    "<summary>Menu harian</summary>",
    "<span>Pengiriman</span>"
  ];
  const positions = steps.map(step => source.indexOf(step));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.ok(!source.includes("5. Ringkasan sebelum terbit"));
  assert.ok(!source.includes("docs-preflight-section"));
  assert.ok(source.includes("function syncPreflightSummary()"));
  assert.match(source, /docsPreflightSummary/);
  assert.match(source, /docsSubmitCount/);
  assert.ok(source.includes("menuController?.count"));
  assert.match(source, /Menu harian belum diisi/);
  assert.match(source, /Pilih minimal satu penerima untuk melanjutkan/);
  assert.ok(source.includes("button.disabled=publishing||!ready"));
  assert.ok(source.includes('status("Memuat daftar penerima dan data pendukung...",false,"loading")'));
});

test("mobile recipient selection stays in the page flow and offers clear grouped filters", () => {
  const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(stylesSource, /\.docs-recipient-box-compact \.docs-recipient-list\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible/s);
  assert.doesNotMatch(stylesSource, /\.docs-recipient-box-compact \.docs-recipient-head\s*\{/);
  assert.ok(source.includes("id='docsRecipientSearch'"));
  assert.ok(source.includes("id='docsRecipientGroup'"));
  assert.ok(source.includes("Pilih semua hasil"));
  assert.ok(source.includes("Hapus pilihan"));
});

test("preview stays open beside the desktop form and has a mobile view switch", () => {
  const theme = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
  assert.match(source, /id='docsPreviewDisclosure' open/);
  assert.match(source, /id='docsEditToggle'[^>]*aria-pressed='true'/);
  assert.match(source, /id='docsPreviewToggle'[^>]*aria-pressed='false'/);
  assert.match(theme, /grid-template-columns:minmax\(288px,1fr\) minmax\(0,2fr\)/);
  assert.match(theme, /:not\(\.show-mobile-preview\) \.docs-preview-panel/);
  assert.match(previewSource, /Pratinjau belum tersedia/);
});


test("P2 archive exposes clear, loading, empty, error, success, and PIN-confirmed delete states", () => {
  assert.match(archiveSource, /function renderLoading\(\)/);
  assert.match(archiveSource, /function renderEmpty\(\)/);
  assert.match(archiveSource, /function renderError\(error\)/);
  assert.match(archiveSource, /docsDaysClearSearch/);
  assert.match(archiveSource, /selectedIds\.size\s*>=\s*60/);
  assert.match(archiveSource, /api\("docs\/delete-history",\s*\{\s*token,\s*distribution_ids:\s*ids\s*\}\)/);
  assert.doesNotMatch(archiveSource, /style=['"]/);
});

test("P2 BAST realization connects labels, communicates local states, and preserves the transactional endpoint", () => {
  assert.match(realizationSource, /label\.htmlFor = inputId/);
  assert.match(realizationSource, /docs-realization-status/);
  assert.match(realizationSource, /panel\.dataset\.state = "loading"/);
  assert.match(realizationSource, /panel\.dataset\.state = "success"/);
  assert.match(realizationSource, /panel\.dataset\.state = "error"/);
  assert.match(realizationSource, /api\("docs\/realization", data\)/);
  assert.match(realizationSource, /min: -50, max: 100/);
  assert.match(realizationSource, /input\.max = String\(delivered\)/);
  assert.match(realizationSource, /addPortionComparison\("Porsi kecil", "diterima_kecil", deliveredSmall, oldSmall\)/);
  assert.match(realizationSource, /addPortionComparison\("Porsi besar", "diterima_besar", deliveredLarge, oldLarge\)/);
  assert.match(realizationSource, /docs-realization-confirmation/);
});

test("P2 Data Master search, loading/error recovery, and form controls are accessible without inline colors", () => {
  assert.match(masterSource, /data-filter-empty/);
  assert.match(masterSource, /dm-load-error/);
  assert.match(masterSource, /addEventListener\("click",load\)/);
  assert.match(masterSource, /output\.setAttribute\("aria-live",bad\?"assertive":"polite"\)/);
  assert.match(masterSource, /lab\.htmlFor=inputId/);
  assert.doesNotMatch(masterSource, /message\.style\.color/);
});



test("P2 archive separates distribution list, detail context, and destructive confirmation area", () => {
  assert.match(archiveSource, /Daftar Distribusi/);
  assert.match(archiveSource, /docs-danger-zone/);
  assert.match(archiveSource, /Area berbahaya · Penghapusan riwayat/);
  assert.match(archiveSource, /dangerZone\.append\(dangerTitle, dangerDescription, selection, confirmSlot\)/);
  assert.match(source, /docs-distribution-detail/);
  assert.match(source, /docs-print-area/);
  assert.match(source, /Kembali ke daftar distribusi/);
});

test("P2 Data Master provides desktop category navigation, mobile selection, grouped recipient fields, and a CSV preview gate", () => {
  assert.match(masterSource, /dm-category-select/);
  assert.match(masterSource, /tabs\.insertBefore\(tabButton,categorySelect\)/);
  assert.match(masterSource, /dataset\.mobileCards=String\(entity==="recipients"\)/);
  assert.match(masterSource, /recipientGroups/);
  assert.match(masterSource, /Rincian jumlah/);
  assert.match(masterSource, /dm-import-preview/);
  assert.match(masterSource, /Konfirmasi impor /);
  assert.doesNotMatch(masterSource, /if\(!confirm\("Impor /);
});


test("P3 visual audit styles cover vertical desktop navigation, mobile dropdown, recipient cards, and paired realization", () => {
  const stylesSource = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
  assert.match(stylesSource, /\.dm-tabs\{grid-column:1;grid-row:2;position:static;top:auto;display:flex;flex-direction:column/);
  assert.match(stylesSource, /\.dm-category-select\{display:block/);
  assert.match(stylesSource, /\.dm-table\[data-mobile-cards=true\] tr\.dm-data-row/);
  assert.match(stylesSource, /\.docs-portion-comparison\{display:grid;grid-template-columns:repeat\(2/);
  assert.match(stylesSource, /\.docs-danger-zone\{display:grid/);
  assert.match(stylesSource, /\.dm-overlay\{z-index:10001\}/);
  assert.match(stylesSource, /\.ai-review-queue\{display:grid/);
});


test("phase 4 obsolete hidden document tabs are removed while main navigation stays intact", () => {
  assert.doesNotMatch(source, /drawTabs|switchTab|docs-tabs/);
  assert.match(masterSource, /function resetSession\(\)/);
  assert.match(masterSource, /request!==loadSequence\|\|modal.hidden/);
});

test("Word template keeps document wording and dynamic snapshot values", () => {
  const scope = { window: {} as { AutoDocPrintRenderer?: { buildPrintHtml: (document: object, escape: (value: unknown) => string, logo: string) => string } } };
  runInNewContext(printRendererSource, scope);
  const render = scope.window.AutoDocPrintRenderer!.buildPrintHtml;
  const escape = (value: unknown) => String(value ?? "").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const snapshot_json = {
    sppg: { nama_sppg: "SPPG Darmaraja", nama_kepala_sppg: "Kepala Uji" },
    distribusi: { tanggal: "2026-11-26" },
    penerima: { nama: "<Sekolah Uji>" },
    rincian_porsi: [{ kelompok_sasaran: "Siswa PAUD/TK", jenis_porsi: "Porsi Kecil", jumlah: 13 }]
  };
  const sj = render({ jenis: "SJ", nomor_lengkap: "001/SJ/SPPG-DMJ/XI/2026", snapshot_json }, escape, "");
  assert.match(sj, /Kamis, 26 November 2026/);
  assert.match(sj, /PENGIRIMAN \/ DISTRIBUSI MBG/);
  assert.match(sj, /&lt;Sekolah Uji&gt;/);
  const bast = render({ jenis: "BAST", nomor_lengkap: "015/BAST/SPPG-DMJ/XI/2026", snapshot_json }, escape, "");
  for (const wording of ["BERITA ACARA SERAH TERIMA (BAST)", "PAKET MAKAN BERGIZI GRATIS (MBG)", "PIHAK PERTAMA", "PIHAK KEDUA", "Jumlah Sebelum", "Jumlah Sesudah", "TOTAL PORSI", "Kondisi makanan saat diterima:", "rangkap 2 (dua)", "Kepala Uji"]) {
    assert.ok(bast.includes(wording), wording);
  }
});
