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
  assert.match(source, /form\.addEventListener\("input",\(\)=>previewController\?\.updateLivePreview\(\)\)/);
  assert.match(source, /form\.addEventListener\("change",\(\)=>previewController\?\.updateLivePreview\(\)\)/);
  assert.match(previewSource, /PRATINJAU · BELUM DITERBITKAN/);
  assert.match(previewSource, /previewPortionRows/);
  assert.match(previewSource, /renderOrganolepticPreview/);
  assert.match(source, /value='ORGANOLEPTIC'/);
  assert.match(previewSource, /docsPreviewRecipientSelect/);
});

test("daily menu supports eight ordered components, suggestions, reordering, and removal", () => {
  assert.match(menuSource, /items\.length>=8/);
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
  assert.match(source, /@page\{size:A4 portrait;margin:0\}/);
  assert.match(source, /break-after:page/);
  assert.match(organolepticSource, /function organolepticSheet/);
  assert.match(organolepticSource, /function organolepticTable/);
  for (const aspect of ["Aroma", "Suhu", "Penampilan", "Citarasa", "Tekstur"]) assert.match(organolepticSource, new RegExp(aspect));
});
test("organoleptic checkboxes and handwritten fields stay blank", () => {
  assert.match(organolepticSource, /for\(let i=0;i<10;i\+\+\)row\.append\(doc\.createElement\("td"\)\)/);
  assert.match(organolepticSource, /organolepticElement\(doc,"div","followup","Tindak Lanjut:"\)/);
  assert.match(organolepticSource, /organolepticElement\(doc,"div","sign-line"\)/);
});
test("organoleptic forms use distribution snapshots and five blank menu rows", () => {
  assert.match(source, /currentDistribution\.nama_ahli_gizi/);
  assert.match(source, /currentDistribution\.waktu_makan/);
  assert.match(source, /currentDistribution\.menu_items/);
  assert.match(organolepticSource, /Array\(5\)\.fill\(""\)/);
  assert.match(organolepticSource, /Nama Posyandu/);
  assert.match(organolepticSource, /Nama Sekolah/);
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

test("printed Surat Jalan has three role-specific signatories", () => {
  assert.match(printRendererSource, /Yang Menyerahkan/);
  assert.match(printRendererSource, /Petugas Distribusi SPPG/);
  assert.match(printRendererSource, /Pengemudi/);
  assert.match(printRendererSource, /Yang Menerima/);
  assert.match(printRendererSource, /sign-line/);
  assert.match(printRendererSource, /sign-space/);
  assert.match(printRendererSource, /signatureBlock\("Pengemudi"/);
  assert.match(printRendererSource, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("printed BAST includes Kepala SPPI from the immutable SPPG snapshot", () => {
  assert.match(printRendererSource, /sppg\.nama_kepala_sppi/);
  assert.match(printRendererSource, /Mengetahui,/);
  assert.match(printRendererSource, /Kepala SPPI/);
  assert.match(printRendererSource, /const signatures=isBast/);
  assert.match(printRendererSource, /signatureBlock\("Yang Menyerahkan"/);
});

test("BAST realization form is isolated in its module and preserves validation and PIN confirmation", () => {
  assert.match(realizationSource, /function showRealization\(card,doc\)/);
  assert.match(realizationSource, /Porsi kecil diterima \*/);
  assert.match(realizationSource, /Porsi besar diterima \*/);
  assert.match(realizationSource, /deliveredSmall/);
  assert.match(realizationSource, /deliveredLarge/);
  assert.match(realizationSource, /name='token' type='password' required minlength='6' maxlength='128'/);
  assert.match(realizationSource, /api\("docs\/realization",data\)/);
  assert.match(realizationSource, /data\.document_id=doc\.id/);
  assert.match(source, /realizationController\.showRealization/);
  assert.match(source, /window\.AutoDocBastRealization\.create/);
});

test("archive module owns global search, page selection, and PIN-protected bulk deletion", () => {
  assert.match(archiveSource, /async function loadDistributions/);
  assert.match(archiveSource, /api\("docs\/days"\+query\)/);
  assert.match(archiveSource, /requestSequence\+\+|\+\+requestSequence/);
  assert.match(archiveSource, /if\(requestId!==requestSequence\)return/);
  assert.match(archiveSource, /docsDaysSelectAll/);
  assert.match(archiveSource, /Pilih semua pada halaman ini/);
  assert.match(archiveSource, /selectedIds\.add/);
  assert.match(archiveSource, /selectedIds\.size<60/);
  assert.match(archiveSource, /docsDaysDelete/);
  assert.match(archiveSource, /docsDeletePin/);
  assert.match(archiveSource, /api\("docs\/delete-history"/);
  assert.match(archiveSource, /distribution_ids:ids/);
  assert.match(archiveSource, /const token=pin\.value/);
  assert.match(source, /archiveController\.loadDistributions/);
});



test("organoleptic renderer module loads before documents and exposes the expected API", () => {
  const rendererTag = htmlSource.indexOf('src="./organoleptic-print.js');
  const printTag = htmlSource.indexOf('src="./documents-print.js');
  const archiveTag = htmlSource.indexOf('src="./archive.js');
  const previewTag = htmlSource.indexOf('src="./document-preview.js');
  const realizationTag = htmlSource.indexOf('src="./bast-realization.js');
  const documentsTag = htmlSource.indexOf('src="./documents.js');
  assert.ok(rendererTag >= 0 && printTag > rendererTag && archiveTag > printTag && previewTag > archiveTag && realizationTag > previewTag && documentsTag > realizationTag);
  assert.ok(organolepticSource.includes("window.AutoDocOrganolepticPrint = Object.freeze"));
  for (const name of ["organolepticElement", "organolepticInfoRow", "organolepticMealNode", "organolepticTable", "organolepticSheet"]) {
    assert.match(organolepticSource, new RegExp(name));
  }
  assert.match(previewSource, /renderOrganolepticPreview/);
});


test("document print renderer formats SJ and BAST snapshots and escapes user content", () => {
  const sandbox = { window: {} };
  runInNewContext(printRendererSource, sandbox);
  const { buildPrintHtml } = sandbox.window.AutoDocPrintRenderer;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const snapshot = {
    sppg: { nama_sppg: "SPPG Darmaraja", alamat: "Alamat", kecamatan: "Darmaraja", kabupaten: "Sumedang", kode_sppg: "01", nama_kepala_sppi: "Kepala SPPI" },
    distribusi: { tanggal: "2026-11-22", jam_berangkat: "08:00", nama_petugas: "Petugas", nama_pengemudi: "Pengemudi", no_kendaraan: "D 1234 XX", menu: "Menu harian" },
    penerima: { nama: "<img src=x onerror=alert(1)>", kelompok: "Sekolah", jenjang: "SD", alamat: "Alamat penerima" },
    rincian_porsi: [{ kelompok_sasaran: "Kelas 1", jenis_porsi: "Porsi Kecil", jumlah: 10 }],
    ringkasan: { total_porsi: 10 }
  };
  const sj = buildPrintHtml({ jenis: "SJ", nomor_lengkap: "SJ/001", snapshot_json: snapshot }, escapeHtml, "logo-bgn.png");
  assert.match(sj, /SURAT JALAN/);
  assert.match(sj, /src='logo-bgn\.png'/);
  assert.match(sj, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(sj, /<img src=x onerror=alert\(1\)>/);
  assert.match(sj, /Petugas Distribusi SPPG/);
  assert.match(sj, /Pengemudi/);
  assert.match(sj, /class='sign-line'/);
  const bast = buildPrintHtml({
    jenis: "BAST", nomor_lengkap: "BAST/001", snapshot_json: snapshot,
    realisasi: { document_id: "real-1", kondisi: "baik", jam_diterima: "09:00", suhu_c: 45, ompreng_kembali: 10, nama_penerima: "Penerima", jabatan_penerima: "Kepala Sekolah", items: [], catatan: "" }
  }, escapeHtml, "logo-bgn.png");
  assert.match(bast, /BERITA ACARA SERAH TERIMA/);
  assert.match(bast, /Kepala SPPI/);
  assert.match(bast, /Realisasi Penerimaan/);
  assert.match(bast, /Penerima/);
});


test("distribution date defaults to today in WIB and departure time starts empty", () => {
  assert.match(source, /function nowInJakarta\(\)/);
  assert.ok(source.includes('timeZone:"Asia/Jakarta"'));
  assert.match(source, /const today=\(\)=>nowInJakarta\(\)/);
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


test("organoleptic signatures have clear writing lines and name positions", () => {
  assert.match(organolepticSource, /organolepticElement\(doc,"div","sign-line"/);
  assert.match(organolepticSource, /organolepticElement\(doc,"div","sign-person"/);
  assert.match(previewSource, /\.sign \.sign-line\{width:82%;height:1px/);
  assert.doesNotMatch(source, /\.sign \.dots\{/);
});

test("all SJ and BAST signatory blocks render a consistent horizontal signature line", () => {
  const sandbox = { window: {} };
  runInNewContext(printRendererSource, sandbox);
  const { buildPrintHtml } = sandbox.window.AutoDocPrintRenderer;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const snapshot = {
    sppg: { nama_kepala_sppi: "Kepala SPPI" },
    distribusi: { nama_petugas: "Petugas", nama_pengemudi: "Pengemudi" },
    penerima: { nama: "Sekolah" },
    rincian_porsi: [], ringkasan: { total_porsi: 0 }
  };
  const sj = buildPrintHtml({jenis:"SJ",nomor_lengkap:"SJ/1",snapshot_json:snapshot},escapeHtml,"logo.png");
  const bast = buildPrintHtml({jenis:"BAST",nomor_lengkap:"BAST/1",snapshot_json:snapshot,realisasi:{nama_penerima:"Penerima",items:[]}},escapeHtml,"logo.png");
  assert.equal((sj.match(/class='sign-line'/g)||[]).length,3);
  assert.equal((bast.match(/class='sign-line'/g)||[]).length,3);
  assert.ok(sj.includes("Petugas</div>"));
  assert.ok(sj.includes("Pengemudi</div>"));
  assert.ok(bast.includes("Kepala SPPI</div>"));
});


test("live document preview is isolated in its own module and initialized before documents", () => {
  assert.match(previewSource, /window\.AutoDocDocumentPreview=Object\.freeze/);
  assert.match(previewSource, /return Object\.freeze\(\{updateLivePreview,fitPreviewFrame\}\)/);
  assert.match(source, /window\.AutoDocDocumentPreview\.create/);
  assert.doesNotMatch(source, /function updateLivePreview|function renderOrganolepticPreview|function fitPreviewFrame/);
});

test("daily menu editor is isolated, capped at eight, and delegates preview refresh", () => {
  assert.match(menuSource, /window\.AutoDocMenuEditor=Object\.freeze/);
  assert.match(menuSource, /items\.length>=8/);
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


test("BAST print shows before/after quantities and names above aligned signature lines", () => {
  const sandbox = { window: {} };
  runInNewContext(printRendererSource, sandbox);
  const { buildPrintHtml } = sandbox.window.AutoDocPrintRenderer;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const snapshot = {
    sppg: { nama_kepala_sppi: "Kepala SPPI" },
    distribusi: { nama_petugas: "Petugas Distribusi" },
    penerima: { nama: "SDN Contoh" },
    rincian_porsi: [
      { kelompok_sasaran: "Siswa kecil", jenis_porsi: "Porsi Kecil", jumlah: 20 },
      { kelompok_sasaran: "Balita", jenis_porsi: "Porsi Kecil", jumlah: 5 },
      { kelompok_sasaran: "Siswa besar", jenis_porsi: "Porsi Besar", jumlah: 10 }
    ],
    ringkasan: { porsi_kecil: 25, porsi_besar: 10, total_porsi: 35 }
  };
  const bast = buildPrintHtml({jenis:"BAST",nomor_lengkap:"BAST/2",snapshot_json:snapshot,realisasi:{
    document_id:"real-2",nama_penerima:"Nama Penerima",items:[
      {jenis_porsi:"Porsi Kecil",jumlah_diserahkan:25,jumlah_diterima:24},
      {jenis_porsi:"Porsi Besar",jumlah_diserahkan:10,jumlah_diterima:9}
    ]
  }},escapeHtml,"logo.png");
  assert.match(bast, /Jumlah Sebelum/);
  assert.match(bast, /Jumlah Sesudah/);
  assert.match(bast, /25<\/td><td style='text-align:right'>24/);
  assert.match(bast, /10<\/td><td style='text-align:right'>9/);
  assert.match(bast, /Nama Penerima<\/div><div class='sign-line'/);
  assert.match(bast, /Petugas Distribusi<\/div><div class='sign-line'/);
  assert.doesNotMatch(bast, /Dokumen dibuat oleh/);
  assert.doesNotMatch(bast, /Snapshot dokumen:/);
  const pending = buildPrintHtml({jenis:"BAST",nomor_lengkap:"BAST/3",snapshot_json:snapshot},escapeHtml,"logo.png");
  assert.match(pending, /Jumlah Sesudah/);
  assert.match(pending, /25<\/td><td style='text-align:right'><\/td>/);
  assert.match(pending, /10<\/td><td style='text-align:right'><\/td>/);
});

test("organoleptic signature names render above aligned horizontal lines", () => {
  const left = organolepticSource.indexOf("left.append(leftHeading");
  const right = organolepticSource.indexOf("right.append(rightHeading");
  assert.ok(left >= 0 && right > left);
  assert.ok(organolepticSource.indexOf('sign-person",data.ahliGizi||""),organolepticElement(doc,"div","sign-line"') >= 0);
  assert.ok(organolepticSource.indexOf('sign-person",""),organolepticElement(doc,"div","sign-line"') >= 0);
  assert.match(source, /sign-heading\{height:10mm/);
  assert.match(source, /sign-person\{height:5mm/);
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


test("optional distribution details print as blank fields rather than dash placeholders", () => {
  for (const field of ["dist.jam_berangkat", "dist.nama_petugas", "dist.nama_pengemudi", "dist.no_kendaraan", "dist.menu", "rec.nama", "rec.kelompok", "rec.alamat"]) {
    assert.ok(printRendererSource.includes(field + '||"'), field + " should be blank when absent");
    assert.ok(!printRendererSource.includes(field + '||"—"'), field + " must not show a dash");
  }
});


test("SJ and BAST letterhead removes SPPG code and generic operational caption", () => {
  assert.doesNotMatch(printRendererSource, /top-meta|kode_sppg|SPPG-DMJ|Dokumen operasional MBG/);
  assert.ok(printRendererSource.includes("grid-template-columns:70px minmax(0,1fr)"));
  assert.ok(printRendererSource.includes("escapeHtml(sppgLocation)"));
});

test("missing SJ and BAST fields and unentered BAST realization print blank, not dashes", () => {
  const sandbox = { window: {} };
  runInNewContext(printRendererSource, sandbox);
  const { buildPrintHtml } = sandbox.window.AutoDocPrintRenderer;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const snapshot = {
    sppg: {}, distribusi: {}, penerima: {}, rincian_porsi: [],
    ringkasan: { total_porsi: 16 }
  };
  for (const jenis of ["SJ", "BAST"]) {
    const html = buildPrintHtml({jenis,nomor_lengkap:"DOC/1",snapshot_json:snapshot},escapeHtml,"logo.png");
    assert.doesNotMatch(html, /—/);
    for (const label of ["Alamat", "Menu", "Pengemudi", "Kendaraan", "Petugas"]) {
      assert.ok(html.includes("<b>"+label+"</b>: </div>"), label + " should be blank when absent");
    }
    assert.ok(html.includes("<b>Total porsi</b>: 16</div>"));
  }
  const pendingBast = buildPrintHtml({jenis:"BAST",nomor_lengkap:"BAST/2",snapshot_json:snapshot},escapeHtml,"logo.png");
  assert.ok(pendingBast.includes("Jumlah Sesudah"));
  assert.doesNotMatch(pendingBast, /—/);
});

test("organoleptic meal options remain normal text for manual marking", () => {
  assert.ok(organolepticSource.includes('["Pagi","Siang","Sore"]'));
  assert.ok(organolepticSource.includes('wrap.append(doc.createTextNode(meal))'));
  assert.ok(!organolepticSource.includes('organolepticElement(doc,"s"'));
});
