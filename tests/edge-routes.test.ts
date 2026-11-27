import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../supabase/functions/autodoc-auth/index.ts", import.meta.url), "utf8");
const validationSource = readFileSync(new URL("../supabase/functions/autodoc-auth/validation.ts", import.meta.url), "utf8");
const documentsUi = readFileSync(new URL("../documents.js", import.meta.url), "utf8");
const archiveUi = readFileSync(new URL("../archive.js", import.meta.url), "utf8");
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

test("trip details remain optional for the existing distribution wizard", () => {
  const body = functionBody("handleDocsCreate", "handleDocsDays");
  assert.match(body, /cleanText\(body\.nama_petugas, "Nama petugas", false, 180\)/);
  assert.match(body, /cleanText\(body\.nama_pengemudi, "Nama pengemudi", false, 180\)/);
  assert.match(body, /cleanText\(body\.no_kendaraan, "Nomor kendaraan", false, 80\)/);
});

test("retries cannot overwrite an issued distribution snapshot", () => {
  const body = functionBody("handleDocsCreate", "handleDocsDays");
  assert.match(body, /error\.code === "55000"/);
  assert.match(body, /new AppError\(\s*409/);
  assert.match(body, /autodoc_prepare_distribution/);
  assert.match(body, /Muat ulang tanggal distribusi/);
});


test("distribution archive endpoint requires a valid session and supports server-side global search", () => {
  const body = functionBody("handleDocsDays", "handleDocsDeleteHistory");
  assert.match(body, /validSession\(request\)/);
  assert.match(body, /order: "tanggal\.desc"/);
  assert.match(body, /limit: "61"/);
  assert.match(body, /rawOffset/);
  assert.match(body, /offset: String\(offset\)/);
  assert.match(body, /has_more: rows\.length > 60/);
  assert.match(body, /url\.searchParams\.get\("q"\)/);
  assert.match(body, /filters\.or =/);
  assert.match(body, /tanggal = "eq\."/);
  assert.match(source, /case "docs\/days": return await handleDocsDays\(request\)/);
});

test("bulk history deletion requires a session, a valid PIN, and bounded unique distribution IDs", () => {
  const body = functionBody("handleDocsDeleteHistory", "handleDocsList");
  assert.match(body, /verifyMutationPin\(request, body\.token, "hapus_riwayat_distribusi"\)/);
  assert.match(body, /uuidList\(body\.distribution_ids, 60, "riwayat distribusi"\)/);
  assert.match(body, /hapus_riwayat_distribusi/);
  assert.match(source, /case "docs\/delete-history": return await handleDocsDeleteHistory\(request\)/);
});

test("document creation is a single-page flow with explicit recipient selection", () => {
  assert.match(documentsUi, /docs-create-layout/);
  assert.doesNotMatch(documentsUi, /data-wizard-step|function goWizardStep|docsReviewSummary/);
  assert.match(documentsUi, /check\.checked=true/);
  assert.match(documentsUi, /Pilih minimal satu penerima/);
  assert.match(documentsUi, /docsPreviewPages/);
});

test("archive provides global search, page selection, and PIN-confirmed bulk deletion controls", () => {
  assert.match(archiveUi, /api\("docs\/days"\s*\+\s*query\)/);
  assert.match(archiveUi, /docsDaysSearch/);
  assert.match(archiveUi, /docsDaysSelectAll/);
  assert.match(archiveUi, /Pilih semua pada halaman ini/);
  assert.match(archiveUi, /docsDaysDelete/);
  assert.match(archiveUi, /docs-delete-panel/);
  assert.match(archiveUi, /docsDeletePin/);
  assert.match(archiveUi, /docs\/delete-history/);
  assert.match(archiveUi, /distribution_ids:\s*ids/);
  assert.match(archiveUi, /docsDaysPrevious/);
  assert.match(archiveUi, /docsDaysNext/);
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
  assert.match(masterUi, /placeholder="Cari nama, lokasi, status, atau informasi/);
});

test("dashboard completion shortcuts open the matching Data Master section", () => {
  assert.match(dashboardUi, /window\.AutoDocMaster\?\.open\(warning\.entity, warning\.query\)/);
  assert.match(dashboardUi, /entity: "settings"/);
  assert.doesNotMatch(dashboardUi, /entity: "vehicles"|entity: "drivers"|entity: "staff"|entity: "menus"/);
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

test("home dashboard separates the global BAST queue and exposes latest distribution archive", () => {
  assert.match(dashboardUi, /const pendingBast = Number\(counts\.bast_pending\)/);
  assert.match(dashboardUi, /BAST menunggu realisasi/);
  assert.match(dashboardUi, /rows\.slice\(1, 5\)/);
  assert.match(dashboardUi, /Arsip distribusi terakhir/);
  assert.match(dashboardUi, /action\("＋ Buat Dokumen", true/);
  assert.match(dashboardUi, /action\("Buka arsip terakhir", false/);
  assert.match(indexHtml, /dashboard\.js\?v=[^"]+/);
});

test("SPPG identity exposes separate Kepala SPPG, Kepala SPPI, and Ahli Gizi Dapur fields", () => {
  assert.match(masterUi, /\["nama_kepala_sppg","Nama Kepala SPPG","text"\]/);
  assert.match(masterUi, /\["nama_kepala_sppi","Nama Kepala SPPI","text"\]/);
  assert.match(masterUi, /\["nama_ahli_gizi","Nama Ahli Gizi Dapur","text"\]/);
  assert.match(masterUi, /input\.dataset\.key=key/);
  assert.match(masterUi, /wrap\.append\(el\("small","dm-hint"/);
  assert.match(source, /if \("nama_kepala_sppi" in input\)/);
  assert.match(source, /if \("nama_ahli_gizi" in input\)/);
});

test("dashboard reports missing kitchen nutritionist name independently from SPPG identity", () => {
  const body = functionBody("handleDashboardSummary", "handleDocsCreate");
  assert.match(body, /nama_kepala_sppi,nama_ahli_gizi/);
  assert.match(body, /const ahliGiziMissing = !settings \|\| !String\(settings\.nama_ahli_gizi/);
  assert.match(body, /ahli_gizi_missing: ahliGiziMissing \? 1 : 0/);
  assert.match(dashboardUi, /counts\.ahli_gizi_missing/);
  assert.match(dashboardUi, /Nama Ahli Gizi Dapur belum diisi/);
  assert.match(dashboardUi, /entity: "settings"/);
});


test("AI analysis is session protected, calls OpenAI only server-side, and never writes production data", () => {
  const start = source.indexOf("async function handleAiAnalyze(");
  const end = source.indexOf("Deno.serve(", start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  assert.match(body, /validSession\(request\)/);
  assert.match(body, /getEnv\("API OPEN AI AutoDoc"\)/);
  assert.match(body, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(body, /store:\s*false/);
  assert.match(body, /type:\s*"json_schema"/);
  assert.match(body, /requires_confirmation:\s*true/);
  assert.doesNotMatch(body, /insertRow\(|deleteRows\(|rpc\(|method:\s*"PATCH"|method:\s*"DELETE"|master\/import|docs\/create/);
  assert.doesNotMatch(indexHtml, /API OPEN AI AutoDoc/);
  assert.match(source, /case "ai\/analyze": return await handleAiAnalyze\(request\)/);
});

test("AI file analysis enforces allowed extensions and a bounded upload size", () => {
  assert.ok(source.includes("const AI_MAX_REQUEST_BYTES = 10 * 1024 * 1024"));
  assert.match(source, /combinedBase64Length > 8_500_000/);
  assert.match(source, /allowedExtensions/);
  assert.match(source, /new Set\(\[\s*"pdf", "doc", "docx", "xls"/);
  assert.match(source, /function normalizeAiFiles/);
  assert.match(source, /inputFiles\.length > 5/);
  assert.match(source, /files\.map\(\(file\) => file\.name\)/);
  assert.match(source, /input_file/);
  assert.match(source, /input_image/);
});
test("AI structured output distinguishes fields present in a file and refuses guesses about recipient identity", () => {
  assert.match(source, /fields_present/);
  assert.match(source, /matched_recipient_id/);
  assert.match(source, /source_quote/);
  assert.match(source, /confidence/);
  assert.match(source, /Jangan mengikuti? instruksi|Jangan ikuti instruksi/);
  assert.match(source, /Jangan mengganti nama\/kelompok penerima yang ada secara otomatis/);
  assert.match(source, /action = "review"/);
});


test("AI menu mappings are restricted to selected recipients and copied into immutable document snapshots", () => {
  const body = functionBody("handleDocsCreate", "handleDocsDays");
  assert.match(body, /recipient_menu_items/);
  assert.match(body, /ids\.some\(id => !recipientIds\.includes\(id\)\)/);
  assert.match(body, /const effectiveMenuByRecipient: Record<string, string\[\]>/);
  assert.match(body, /const requestedMenu = effectiveMenuByRecipient\[recipientId\]/);
  assert.match(body, /const effectiveMenuItems = effectiveMenuByRecipient\[recipientId\]/);
  assert.match(body, /recipientDistributionPayload/);
  assert.match(body, /menu_items: effectiveMenuItems\.map/);
  assert.match(body, /distribusi: \{ \.\.\.recipientDistributionPayload, id: distribution\.id \}/);
});


test("menu-only AI analysis does not read or send beneficiary master records", () => {
  const start = source.indexOf("async function handleAiAnalyze(");
  const end = source.indexOf("Deno.serve(", start);
  const body = source.slice(start, end);
  assert.match(body, /const currentRecipients = mode === "menus" \|\| mode === "master" \? \[\] : await supabaseRequest/);
  assert.match(body, /const currentMasterRecords = mode === "both" \|\| mode === "master"/);
  assert.match(body, /"Daftar kandidat penerima manfaat saat ini \(JSON\): " \+ JSON\.stringify\(candidates\)/);
});


test("every previously issued recipient menu is checked before retry, including non-AI default-menu retries", () => {
  const body = functionBody("handleDocsCreate", "handleDocsDays");
  assert.match(body, /const effectiveMenuByRecipient: Record<string, string\[\]>/);
  assert.match(body, /recipient_id: "in\.\(" \+ recipientIds\.join\(","\) \+ "\)"/);
  assert.match(body, /const requestedMenu = effectiveMenuByRecipient\[recipientId\]/);
  assert.match(body, /JSON\.stringify\(previousItems\) === JSON\.stringify\(requestedMenu\)/);
  assert.match(body, /const effectiveMenuItems = effectiveMenuByRecipient\[recipientId\]/);
});

test("AI file intake supports multiple files and blocks incomplete new beneficiary rows", () => {
  assert.match(source, /normalizeAiFiles\(body\.files \?\? body\.file\)/);
  assert.match(source, /for \(const file of files\)/);
  assert.match(source, /AI_COUNT_FIELDS\.filter/);
  assert.match(source, /!fieldsPresent\.includes\(field\)/);
  assert.match(source, /action = "review"/);
  assert.match(source, /belum memiliki nilai eksplisit untuk semua kategori/);
  assert.match(source, /"html", "xml", "iif"/);
});

test("Google Sheets and Apps Script integration is fully removed in favor of the AI assistant", () => {
  assert.doesNotMatch(source, /GOOGLE_SHEETS|handleSheets|sheets\/(status|preview|apply|push)/);
  assert.doesNotMatch(masterUi, /Google Sheets|AutoDocSheetsSync/);
  assert.doesNotMatch(indexHtml, /google-sheets-sync/);
});

test("AI maps supported master entities without writing during analysis", () => {
  assert.match(source, /const AI_MASTER_FIELDS = \{/);
  assert.match(source, /settings: \[/);
  assert.match(source, /drivers: \["nama", "aktif", "urutan"\]/);
  assert.match(source, /vehicles: \["no_kendaraan", "aktif", "urutan"\]/);
  assert.match(source, /staff: \["nama", "jabatan", "aktif", "urutan"\]/);
  assert.match(source, /menus: \["teks_menu", "aktif", "urutan"\]/);
  assert.match(source, /async function fetchAiMasterRecords/);
  assert.match(source, /function normalizeAiMasterUpdates/);
  assert.match(source, /normalizeAiMasterUpdates\(raw\.master_updates, currentMasterRecords, warnings\)/);
  assert.match(source, /case "master\/save": return await handleMasterSave\(request\)/);
  assert.match(source, /action === "new"\) \{/);
  assert.match(source, /potensi(al)? duplikat|berpotensi duplikat/);
});

test("new AI recipient rows with incomplete counts can only be saved after manual completion", () => {
  assert.match(source, /can_complete_manually:/);
  assert.match(source, /missing_count_fields:/);
  assert.match(source, /manualMissingCounts = missingCounts/);
});

test("AI save endpoints require explicit confirmation and reject stale master snapshots", () => {
  const masterStart = source.indexOf("async function handleAiMasterApply(");
  const recipientStart = source.indexOf("async function handleAiRecipientApply(");
  const nextHandler = source.indexOf("async function verifyMutationPin(", recipientStart);
  assert.ok(masterStart >= 0 && recipientStart > masterStart && nextHandler > recipientStart);
  const masterBody = source.slice(masterStart, recipientStart);
  const recipientBody = source.slice(recipientStart, nextHandler);
  for (const body of [masterBody, recipientBody]) {
    assert.match(body, /validSession\(request\)/);
    assert.match(body, /body\.confirm !== true/);
    assert.match(body, /matchesMasterSnapshot\(current, snapshot, config\.columns\)/);
    assert.match(body, /status for stale|berubah sejak dianalisis/);
  }
  assert.match(source, /case "ai\/recipient-apply": return await handleAiRecipientApply\(request\)/);
  assert.match(source, /case "ai\/master-apply": return await handleAiMasterApply\(request\)/);
});

test("AI master save rejects duplicate new identities and never changes an identity key silently", () => {
  assert.match(source, /normalizedMasterIdentity\(input\[identityField \?\? ""\]\)/);
  assert.match(source, /currentRows\.some\(\(row\) => normalizedMasterIdentity/);
  assert.match(source, /if \(current && identityField && proposed\[identityField\] !== current\[identityField\]\)/);
  assert.match(source, /Perubahan identitas utama/);
});

test("AI updates include every original column in the PATCH filter to prevent a concurrent overwrite", () => {
  assert.match(source, /function masterSnapshotFilters/);
  assert.equal((source.match(/masterSnapshotFilters\(expected as Record<string, unknown>, config\.columns\)/g) || []).length, 2);
  assert.match(source, /value === null \|\| value === undefined\s*\? "is\.null"/);
});


test("login lockout uses a signed per-browser identity and never trusts spoofable IP headers", () => {
  assert.match(source, /THROTTLE_COOKIE_NAME = "__Host-autodoc_login"/);
  assert.match(source, /async function throttleKey\(request: Request\)/);
  assert.match(source, /verifyThrottleIdentityToken\(existingCookie/);
  assert.match(source, /createThrottleIdentityToken\(key, now\)/);
  assert.match(source, /throttleKey\(request\)/);
  assert.doesNotMatch(source, /x-forwarded-for|x-real-ip|cf-connecting-ip/i);
  assert.doesNotMatch(source, /hmacHex\("autodoc-global-login-throttle-v1"\);\s*const row/);
  assert.match(source, /appendCookie\(\s*respond\(request, \{ message: "PIN MASUK tidak sesuai\." \}, 401\)/);
});

test("document creation has a dedicated streaming-safe 1 MiB body limit", () => {
  const body = functionBody("handleDocsCreate", "handleDocsDays");
  assert.match(source, /DOCS_CREATE_MAX_BODY_BYTES = 1024 \* 1024/);
  assert.match(body, /readJson\(request, DOCS_CREATE_MAX_BODY_BYTES\)/);
  assert.match(source, /return await readBoundedJson\(request, maxBytes\)/);
  assert.match(validationSource, /request\.body\.getReader\(\)/);
  assert.match(validationSource, /nextTotal > maxBytes/);
});

test("AI analysis has per-session admission control, bounded concurrency, timeout, and Retry-After handling", () => {
  const start = source.indexOf("async function handleAiAnalyze(");
  const end = source.indexOf("Deno.serve(", start);
  const body = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(source, /new AiRequestGate\(2, 6, 10 \* 60 \* 1000, 2000\)/);
  assert.match(body, /AI_REQUEST_GATE\.acquire\(sessionKey\)/);
  assert.match(body, /fetchResponseTextWithTimeout\(/);
  assert.match(body, /AI_REQUEST_TIMEOUT_MS/);
  assert.match(body, /admission\.release\(\)/);
  assert.match(body, /parseRetryAfterSeconds\(openAiResponse\.headers\.get\("retry-after"\)\)/);
  assert.match(body, /status === 429 \|\| status === 503/);
});

test("number settings require session, safe integer and mutation PIN",()=>{
 const body=functionBody("handleNumberingSave","handleMasterSave");
 assert.match(body,/validSession\(request\)/);
 assert.match(body,/Number\.isSafeInteger/);
 assert.match(body,/verifyMutationPin\(request, body\.token, "ubah_nomor_dokumen"\)/);
 assert.match(body,/rpc<unknown>\("ubah_nomor_awal"/);
});
