import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:4173/";
const recipientId = "11111111-1111-4111-8111-111111111111";
const distributionId = "22222222-2222-4222-8222-222222222222";
let server;
let browser;

before(async () => {
  server = spawn("python3", ["-m", "http.server", "4173", "--bind", "127.0.0.1"], {
    cwd: process.cwd(),
    stdio: "ignore"
  });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4173/");
      if (response.ok) { ready = true; break; }
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(ready, true, "static test server should start");
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  server?.kill("SIGTERM");
});

async function openApp({ authenticated = true, viewport = { width: 1365, height: 900 }, apiFailures = {}, apiDelays = {} } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const writes = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.route("**/functions/v1/autodoc-auth/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const routeName = url.pathname.split("/autodoc-auth/")[1] || "";
    if (apiDelays[routeName]) await new Promise(resolve => setTimeout(resolve, apiDelays[routeName]));
    if (apiFailures[routeName] > 0) {
      apiFailures[routeName] -= 1;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Simulasi gangguan layanan." }) });
      return;
    }
    let payload = {};

    if (routeName === "setup/status") payload = { setupRequired: false };
    else if (routeName === "auth/session") payload = { authenticated };
    else if (routeName === "dashboard/summary") {
      payload = {
        counts: { distributions: 2, bast_pending: 2, sppg_missing_fields: 1, ahli_gizi_missing: 1, recipients_missing_address: 1, recipients_need_verification: 1 },
        recent_distributions: [
          { id: distributionId, tanggal: "2026-11-23", menu: "Nasi, ayam", documents_count: 4, bast_pending: 1 },
          { id: "33333333-3333-4333-8333-333333333333", tanggal: "2026-11-22", menu: "Nasi, telur", documents_count: 2, bast_pending: 0 }
        ]
      };
    } else if (routeName === "master/list") {
      payload = { data: { settings: [{ nama_kepala_sppg: "Kepala SPPG", nama_kepala_sppi: "Kepala SPPI", nama_ahli_gizi: "Ahli Gizi" }], recipients: [{
        id: recipientId, nama: "SDN UJI BROWSER", kelompok: "Sekolah/Lembaga", jenjang: "SD", alamat: "Alamat Uji",
        aktif: true, urutan: 10, total_porsi: 16, siswa_kecil: 16, siswa_besar: 0, tendik: 0,
        ibu_hamil: 0, ibu_menyusui: 0, balita: 0, putus_sekolah: 0, kader: 0
      }], staff: [], drivers: [], vehicles: [], menus: [] } };
    } else if (routeName === "ai/analyze") {
      writes.push({ route: routeName, body: request.postDataJSON() });
      const aiBody = request.postDataJSON();
      payload = {
        success: true, requires_confirmation: true,
        analysis: {
          summary: aiBody.mode === "recipients" ? "Ditemukan perubahan jumlah siswa kecil pada penerima." : aiBody.mode === "master" ? "Ditemukan satu data pengemudi untuk Data Master." : "Ditemukan satu kelompok menu untuk sekolah uji.",
          questions: [], warnings: [],
          menu_groups: aiBody.mode === "recipients" || aiBody.mode === "master" ? [] : [{
            id: "ai-menu-1", label: "Menu SDN Uji Browser", target_names: ["SDN UJI BROWSER"],
            target_ids: [recipientId], menu_items: ["Nasi Putih", "Ayam Kecap"], confidence: "tinggi",
            reason: "Nama sekolah disebut eksplisit dalam teks.", source_reference: "Paragraf 1"
          }],
          recipient_updates: aiBody.mode === "recipients"
            ? (aiBody.text.includes("UJI_PENERIMA_BARU") ? [{
              id: "ai-recipient-new", action: "review", matched_recipient_id: null,
              current: null,
              proposed: { kelompok: "Sekolah/Lembaga", nama: "TK UJI BARU", jenjang: "TK", alamat: "", siswa_kecil: null, siswa_besar: null, tendik: null, ibu_hamil: null, ibu_menyusui: null, balita: null, putus_sekolah: null, kader: null, urutan: 20, aktif: true, keterangan: "", perlu_verifikasi: false, catatan_verifikasi: "" },
              changed_fields: ["kelompok", "nama", "jenjang"], fields_present: ["kelompok", "nama", "jenjang"],
              missing_count_fields: ["siswa_kecil", "siswa_besar", "tendik", "ibu_hamil", "ibu_menyusui", "balita", "putus_sekolah", "kader"],
              can_complete_manually: true, confidence: "sedang",
              reason: "Identitas penerima terlihat tetapi jumlah belum lengkap.",
              source_quote: "TK UJI BARU", source_reference: "Sheet penerima, baris 2"
            }] : [{
              id: "ai-recipient-1", action: "update", matched_recipient_id: recipientId,
              current: { id: recipientId, kelompok: "Sekolah/Lembaga", nama: "SDN UJI BROWSER", jenjang: "SD", alamat: "Alamat Uji", siswa_kecil: 16, siswa_besar: 0, tendik: 0, ibu_hamil: 0, ibu_menyusui: 0, balita: 0, putus_sekolah: 0, kader: 0, porsi_kecil: 16, porsi_besar: 0, total_porsi: 16, urutan: 10, aktif: true, keterangan: null, perlu_verifikasi: false, catatan_verifikasi: null },
              proposed: { kelompok: "Sekolah/Lembaga", nama: "SDN UJI BROWSER", jenjang: "SD", alamat: "Alamat Uji", siswa_kecil: 18, siswa_besar: 0, tendik: 0, ibu_hamil: 0, ibu_menyusui: 0, balita: 0, putus_sekolah: 0, kader: 0, urutan: 10, aktif: true },
              changed_fields: ["siswa_kecil"], fields_present: ["siswa_kecil"], confidence: "tinggi",
              reason: "Jumlah pada file berbeda dari data master.", source_quote: "Siswa kecil: 18", source_reference: "Sheet 1, baris 2"
            }])
            : [],
          master_updates: aiBody.mode === "master" ? [{
            id: "ai-master-1", entity: "drivers", action: "new", matched_record_id: null,
            current: null, proposed: { nama: "Budi Santoso", aktif: true, urutan: 100 },
            changed_fields: ["nama"], fields_present: ["nama"], confidence: "tinggi",
            reason: "Nama pengemudi disebut eksplisit.", source_quote: "Pengemudi: Budi Santoso",
            source_reference: "Sheet Data Pengemudi, baris 2"
          }] : [],
          current_recipient_count: 1
        },
        message: "Analisis selesai. Periksa hasil dan konfirmasi."
      };
    } else if (routeName === "master/recipients") {
      payload = { recipients: [{
        id: recipientId, nama: "SDN UJI BROWSER", kelompok: "Sekolah/Lembaga", jenjang: "SD",
        total_porsi: 16, siswa_kecil: 16, balita: 0, siswa_besar: 0, tendik: 0,
        ibu_hamil: 0, ibu_menyusui: 0, putus_sekolah: 0, kader: 0
      }] };
    } else if (routeName === "docs/days") {
      const query = url.searchParams.get("q") || "";
      payload = {
        distributions: query ? [] : [{
          id: distributionId, tanggal: "2026-11-23", menu: "Nasi, ayam", nama_petugas: "Petugas Uji",
          nama_pengemudi: "Pengemudi Uji", no_kendaraan: "BE 1234 XX"
        }],
        offset: 0, has_more: false
      };
    } else if (routeName.startsWith("docs/list")) {
      payload = {
        distribution: { id: distributionId, tanggal: "2026-11-23", menu: "Nasi, ayam", waktu_makan: "siang", nama_petugas: "Petugas Uji", nama_pengemudi: "Pengemudi Uji", no_kendaraan: "BE 1234 XX", menu_items: [] },
        documents: [{
          id: "44444444-4444-4444-8444-444444444444", recipient_id: recipientId, jenis: "BAST",
          nomor_lengkap: "BAST-2026-001", status: "ditandatangani", realisasi: null,
          snapshot_json: { penerima: { id: recipientId, nama: "SDN UJI BROWSER", kelompok: "Sekolah/Lembaga", jenjang: "SD", total_porsi: 16, porsi_kecil: 10, porsi_besar: 6 } }
        }]
      };
    } else if (request.method() === "POST") {
      writes.push({ route: routeName, body: request.postDataJSON() });
      payload = { message: "Mock response", berhasil: 0, requested: 0, errors: [] };
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await page.goto(origin, { waitUntil: "domcontentloaded" });
  if (authenticated) await page.locator("#homePage:not([hidden])").waitFor();
  else await page.locator("#loginPanel:not([hidden])").waitFor();
  return { context, page, writes, errors };
}

test("login page renders after session check and password visibility control works", async () => {
  const app = await openApp({ authenticated: false });
  try {
    const input = app.page.locator("#accessToken");
    assert.equal(await input.getAttribute("type"), "password");
    await app.page.locator("#toggleVisibility").click();
    assert.equal(await input.getAttribute("type"), "text");
    await app.page.locator("#toggleVisibility").click();
    assert.equal(await input.getAttribute("type"), "password");
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});

test("desktop and mobile sidebar controls work, and creation preview follows recipient and form input", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator("#homeMenuToggle").click();
    await page.locator("#homePage.sidebar-collapsed").waitFor();
    assert.equal(await page.locator("#homeMenuToggle").getAttribute("aria-expanded"), "false");
    await page.locator("#homeMenuToggle").click();
    await page.locator("#homePage:not(.sidebar-collapsed)").waitFor();

    await page.locator('[data-home-nav="print"]').click();
    await page.locator("#docsCreateForm").waitFor();
    await page.locator(".docs-recipient").waitFor();
    for (const id of ["docsStaff", "docsDriver", "docsVehicle"]) {
      assert.equal(await page.locator("#" + id).getAttribute("required"), null);
    }
    await page.locator("#docsShippingDisclosure > summary").click();
    await page.locator("input[name='recipient']").check();
    await page.locator("#docsPreviewToggle").click();
    const preview = page.frameLocator("#docsPreviewFrame").locator("body");
    await preview.getByText("PRATINJAU · BELUM DITERBITKAN").waitFor();
    await page.locator("#docsStaff").fill("Petugas Browser Test");
    await preview.getByText("Petugas Browser Test", { exact: true }).waitFor();
    assert.equal(app.writes.some(item => item.route === "docs/create"), false);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }

  const mobile = await openApp({ viewport: { width: 390, height: 844 } });
  try {
    await mobile.page.locator("#homeMenuToggle").click();
    await mobile.page.locator("#homePage.mobile-nav-open").waitFor();
    await mobile.page.locator('[data-home-nav="archive"]').click();
    await mobile.page.locator("#homePage:not(.mobile-nav-open)").waitFor();
    await mobile.page.locator("#docsDaysList").waitFor();
    assert.deepEqual(mobile.errors, []);
  } finally {
    await mobile.context.close();
  }
});

test("P0 shared design system and active navigation context work without runtime stylesheet injection", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    const context = page.locator(".home-pagebar-text");
    assert.equal((await context.textContent()).trim(), "Beranda");
    for (const [key,label] of [["home","Beranda"],["print","Buat Dokumen"],["archive","Arsip"],["master","Data Master"]]) {
      assert.equal(await page.locator('[data-home-nav="' + key + '"]').getAttribute("aria-label"), label);
    }
    const tokens = await page.locator("body").evaluate(node => {
      const style = getComputedStyle(node);
      return { canvas: style.getPropertyValue("--color-canvas").trim(), primary: style.getPropertyValue("--color-primary").trim() };
    });
    assert.equal(tokens.canvas, "#F5F7F5");
    assert.equal(tokens.primary, "#1D5B43");
    await page.locator('[data-home-nav="print"]').click();
    await page.locator("#docsCreateForm").waitFor();
    assert.equal((await context.textContent()).trim(), "Buat Dokumen");
    assert.equal(await page.locator("style").count(), 0);
    await page.locator(".docs-close").click();
    await page.locator(".docs-overlay").waitFor({ state: "hidden" });
    await page.locator('[data-home-nav="master"]').click();
    await page.locator(".dm-overlay:not([hidden])").waitFor();
    assert.equal((await context.textContent()).trim(), "Data Master");
    await page.getByRole("button", { name: "Asisten AI" }).click();
    assert.equal(await page.locator("style").count(), 0);
    await page.locator(".dm-close").click();
    await page.locator(".dm-overlay").waitFor({ state: "hidden" });
    await page.locator('[data-home-nav="archive"]').click();
    await page.locator("#docsDaysList").waitFor();
    assert.equal((await context.textContent()).trim(), "Arsip");
    await page.locator(".docs-close").click();
    await page.locator(".docs-overlay").waitFor({ state: "hidden" });
    await page.locator('[data-home-nav="home"]').click();
    await page.locator("#opsDashboard").waitFor();
    assert.equal((await context.textContent()).trim(), "Beranda");
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});

test("P1 operator dashboard and document form work on desktop and mobile", async () => {
  const desktop = await openApp();
  try {
    const page = desktop.page;
    await page.locator(".home-operator-hero").waitFor();
    assert.equal(await page.locator("#opsDashboard").getAttribute("data-state"), "success");
    assert.notEqual((await page.locator(".home-operational-date").getAttribute("datetime")) || "", "");
    assert.equal((await page.locator(".home-bast-count").textContent()).trim(), "2");
    assert.equal(await page.locator(".home-master-check").isVisible(), true);
    assert.equal(await page.locator(".home-archive-card").isVisible(), true);

    await page.locator('[data-dashboard-action="create"]').click();
    await page.locator("#docsCreateForm").waitFor();
    const headings = await page.locator("#docsCreateForm .docs-form-section-head h4").allTextContents();
    assert.deepEqual(headings, [
      "1. Informasi distribusi",
      "2. Menu & penerima",
      "3. Informasi pengiriman"
    ]);
    assert.equal(await page.locator("#docsPreviewDisclosure").evaluate(element => element.open), false);
    const previewPosition = await page.locator("#docsPreviewDisclosure").evaluate(element => getComputedStyle(element).position);
    assert.equal(previewPosition, "static");
    assert.equal(await page.locator("#docsShippingDisclosure").evaluate(element => element.open), false);
    assert.equal(await page.locator("#docsCreateButton").isDisabled(), true);
    assert.match(await page.locator("#docsPreflightSummary").textContent(), /minimal satu penerima/);

    await page.locator("#docsPreviewToggle").click();
    assert.equal(await page.locator("#docsPreviewDisclosure").evaluate(element => element.open), true);
    const emptyPreview = page.frameLocator("#docsPreviewFrame").locator("body");
    await emptyPreview.getByText("Pratinjau belum tersedia").waitFor();

    await page.locator("input[name='recipient']").check();
    const summary = await page.locator("#docsPreflightSummary").innerText();
    assert.match(summary, /Siap diterbitkan/);
    assert.match(await page.locator("#docsSubmitCount").textContent(), /1 penerima/);
    assert.match(await page.locator("#docsSubmitCount").textContent(), /16 porsi/);
    assert.equal(await page.locator("#docsCreateButton").isDisabled(), false);
    await page.locator("#docsRecipientGroup").selectOption("Sekolah/Lembaga");
    assert.equal(await page.locator(".docs-recipient:visible").count(), 1);
    await page.locator("#docsPreviewDisclosure").evaluate(element => { element.open = true; });
    const preview = page.frameLocator("#docsPreviewFrame").locator("body");
    await preview.getByText("SDN UJI BROWSER", { exact: false }).waitFor();
    const recipientOverflow = await page.locator("#docsRecipientList").evaluate(element => getComputedStyle(element).overflowY);
    assert.equal(recipientOverflow, "visible");
    assert.equal(desktop.writes.some(item => item.route === "docs/create"), false);
    assert.deepEqual(desktop.errors, []);
  } finally {
    await desktop.context.close();
  }

  const mobile = await openApp({ viewport: { width: 390, height: 844 } });
  try {
    const page = mobile.page;
    await page.locator('[data-dashboard-action="create"]').click();
    await page.locator("#docsCreateForm").waitFor();
    assert.equal(await page.locator("#docsPreviewDisclosure").evaluate(element => element.open), false);
    const recipientTools = page.locator(".docs-recipient-tools");
    assert.equal(await recipientTools.evaluate(element => getComputedStyle(element).position), "static");
    assert.equal(await page.locator("#docsRecipientList").evaluate(element => getComputedStyle(element).overflowY), "visible");
    await page.locator("input[name='recipient']").check();
    assert.match(await page.locator("#docsSubmitCount").textContent(), /16 porsi/);
    await page.locator("#docsPreviewToggle").click();
    assert.equal(await page.locator("#docsPreviewDisclosure").evaluate(element => element.open), true);
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.equal(noOverflow, true);
    assert.deepEqual(mobile.errors, []);
  } finally {
    await mobile.context.close();
  }
});


test("P2 archive search has a recoverable empty state and returns to the full list", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="archive"]').click();
    await page.locator("#docsDaysList .docs-day-card").waitFor();
    assert.equal(await page.locator("#docsDaysList").getAttribute("data-state"), "success");
    await page.locator("#docsDaysSearch").fill("ARSIP_TIDAK_ADA");
    await page.locator(".docs-archive-empty").waitFor();
    assert.equal(await page.locator("#docsDaysList").getAttribute("data-state"), "empty");
    assert.equal(await page.getByRole("button", { name: "Bersihkan pencarian" }).isVisible(), true);
    await page.getByRole("button", { name: "Bersihkan pencarian" }).click();
    await page.locator("#docsDaysList .docs-day-card").waitFor();
    assert.equal(await page.locator("#docsDaysList").getAttribute("data-state"), "success");
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});

test("P2 Data Master shows search empty state, retry-ready status, and connected field labels", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="master"]').click();
    await page.locator(".dm-table-wrap .dm-data-row").waitFor();
    assert.equal(await page.locator(".dm-msg").getAttribute("role"), "status");
    await page.locator(".dm-search").fill("DATA_TIDAK_ADA");
    await page.locator(".dm-filter-empty").waitFor({ state: "visible" });
    assert.equal(await page.locator(".dm-table-wrap").getAttribute("data-state"), "empty");
    await page.locator(".dm-search").fill("");
    assert.equal(await page.locator(".dm-table-wrap").getAttribute("data-state"), "success");
    await page.getByRole("button", { name: "+ Tambah" }).click();
    const nameInput = page.getByLabel("Nama penerima");
    assert.equal(await nameInput.getAttribute("id"), "dmField_nama");
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});

test("P2 BAST realization keeps labels connected and sends the existing transactional payload", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="archive"]').click();
    await page.locator("#docsDaysList .docs-day-card").waitFor();
    await page.locator("#docsDaysList .docs-day-card .docs-btn.primary").click();
    await page.locator("#docsList").waitFor();
    await page.getByRole("button", { name: "Input realisasi" }).click();

    assert.equal(await page.locator(".docs-portion-comparison").isVisible(), true);
    assert.equal(await page.locator(".docs-realization-confirmation").isVisible(), true);
    const small = page.getByLabel("Porsi kecil diterima *");
    const large = page.getByLabel("Porsi besar diterima *");
    assert.equal(await small.getAttribute("max"), "10");
    assert.equal(await large.getAttribute("max"), "6");
    await page.getByLabel("Kondisi makanan *").selectOption("baik");
    await page.getByLabel("Jam diterima *").fill("12:30");
    await page.getByLabel("Nama penerima *").fill("Penerima Uji");
    await page.getByLabel("PIN akses untuk konfirmasi *").fill("123456");
    await page.getByRole("button", { name: "Simpan realisasi" }).click();

    const request = app.writes.find(item => item.route === "docs/realization");
    assert.ok(request);
    assert.equal(request.body.document_id, "44444444-4444-4444-8444-444444444444");
    assert.equal(request.body.kondisi, "baik");
    assert.equal(request.body.diterima_kecil, "10");
    assert.equal(request.body.diterima_besar, "6");
    assert.equal(request.body.token, "123456");
    await page.locator(".docs-realization").waitFor({ state: "detached" });
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});

test("archive selection opens PIN confirmation without performing a delete", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="archive"]').click();
    await page.locator("#docsDaysList .docs-day-card").waitFor();
    await page.locator(".docs-day-pick input").check();
    await page.getByRole("button", { name: /Hapus dipilih/ }).click();
    await page.locator("#docsDeletePin").waitFor();
    assert.equal(await page.getByRole("button", { name: "Hapus permanen" }).isVisible(), true);
    assert.equal(app.writes.some(item => item.route === "docs/delete-history"), false);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});


test("AI assistant applies school menu and preselects mapped recipients before issuance", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="master"]').click();
    await page.getByRole("button", { name: "Asisten AI" }).click();
    await page.locator("#aiSourceText").fill("SDN UJI BROWSER: Nasi Putih, Ayam Kecap");
    await page.getByRole("button", { name: "Baca dan klasifikasikan" }).click();
    await page.getByText("Menu SDN Uji Browser", { exact: true }).waitFor();
    assert.equal(app.writes.some(item => item.route === "ai/analyze"), true);
    await page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Terapkan menu ke Buat Dokumen" }).click();
    await page.locator("#docsCreateForm").waitFor();
    const recipientCheckbox = page.locator("input[name='recipient']");
    await recipientCheckbox.waitFor();
    assert.equal(await recipientCheckbox.isChecked(), true, "AI should preselect the mapped recipient");
    assert.equal(await page.locator("#docsSelectedCount").textContent(), "(1 dipilih)");
    await page.locator("#docsPreviewToggle").click();
    const preview = page.frameLocator("#docsPreviewFrame").locator("body");
    await preview.getByText("Nasi Putih", { exact: false }).waitFor();
    assert.equal(await page.locator("#docsAiMenuPlanNotice").isVisible(), true);
    await page.getByRole("button", { name: "Terbitkan dokumen" }).click();
    const createRequest = app.writes.find(item => item.route === "docs/create");
    assert.ok(createRequest, "document creation should use the mocked local API");
    assert.deepEqual(createRequest.body.recipient_menu_items[recipientId], ["Nasi Putih", "Ayam Kecap"]);
    assert.equal(createRequest.body.recipient_ids.includes(recipientId), true);
    assert.equal(app.writes.some(item => item.route === "master/import"), false);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});


test("AI beneficiary update is only imported after the user selects the row and confirms", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="master"]').click();
    await page.getByRole("button", { name: "Asisten AI" }).click();
    await page.locator("#aiMode").selectOption("recipients");
    await page.locator("#aiSourceText").fill("SDN UJI BROWSER\nSiswa kecil: 18");
    await page.getByRole("button", { name: "Baca dan klasifikasikan" }).click();
    await page.getByText("Sebelumnya: 16", { exact: false }).waitFor();
    assert.equal(app.writes.some(item => item.route === "master/import"), false);
    const row = page.locator("[data-recipient-row='0']");
    await row.locator("[data-include-recipient]").check();
    await page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Konfirmasi & simpan penerima" }).click();
    await page.locator(".ai-status").getByText(/baris penerima berhasil disimpan/).waitFor();
    const importRequest = app.writes.find(item => item.route === "ai/recipient-apply");
    assert.ok(importRequest);
    assert.equal(importRequest.body.confirm, true);
    assert.equal(importRequest.body.expected.id, recipientId);
    assert.equal(importRequest.body.data.siswa_kecil, 18);
    assert.equal(app.writes.some(item => item.route === "master/import"), false);
    assert.equal(app.writes.some(item => item.route === "docs/create"), false);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});

test("AI assistant can read and map multiple source files in one review", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="master"]').click();
    await page.getByRole("button", { name: "Asisten AI" }).click();
    await page.locator("#aiSourceFiles").setInputFiles([
      { name: "menu-harian.csv", mimeType: "text/csv", buffer: Buffer.from("Tujuan,Menu\\nSDN UJI BROWSER,Nasi Putih; Ayam Kecap") },
      { name: "catatan-penerima.txt", mimeType: "text/plain", buffer: Buffer.from("Catatan data penerima manfaat untuk ditinjau.") }
    ]);
    await page.getByRole("button", { name: "Baca dan klasifikasikan" }).click();
    await page.getByText("Menu SDN Uji Browser", { exact: true }).waitFor();
    const request = app.writes.find(item => item.route === "ai/analyze");
    assert.ok(request);
    assert.equal(request.body.files.length, 2);
    assert.deepEqual(request.body.files.map(file => file.name), ["menu-harian.csv", "catatan-penerima.txt"]);
    await page.locator("#aiSourceText").fill("Sumber berubah setelah analisis.");
    assert.equal(await page.locator(".ai-result-content").isVisible(), false, "old AI proposals must disappear when source changes");
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});

test("AI maps new driver records to Data Master and saves only after selection and confirmation", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="master"]').click();
    await page.getByRole("button", { name: "Asisten AI" }).click();
    await page.locator("#aiMode").selectOption("master");
    await page.locator("#aiSourceText").fill("Daftar pengemudi:\nPengemudi: Budi Santoso");
    await page.getByRole("button", { name: "Baca dan klasifikasikan" }).click();
    await page.getByText("Pengemudi · Budi Santoso", { exact: true }).waitFor();

    assert.equal(app.writes.some(item => item.route === "ai/master-apply"), false, "analysis must not save data");
    const row = page.locator("[data-master-row='0']");
    const check = row.locator("[data-include-master]");
    assert.equal(await check.isChecked(), false);
    await check.check();
    await page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Konfirmasi & simpan Data Master" }).click();
    await page.locator(".ai-status").getByText("1 data master berhasil disimpan.").waitFor();

    const save = app.writes.find(item => item.route === "ai/master-apply");
    assert.ok(save);
    assert.equal(save.body.confirm, true);
    assert.equal(save.body.expected, null);
    assert.equal(save.body.entity, "drivers");
    assert.equal(save.body.data.nama, "Budi Santoso");
    assert.equal(app.writes.some(item => item.route === "master/save"), false);
    assert.equal(app.writes.some(item => item.route === "master/import"), false);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});

test("AI new beneficiary with incomplete source counts can be completed manually before save", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="master"]').click();
    await page.getByRole("button", { name: "Asisten AI" }).click();
    await page.locator("#aiMode").selectOption("recipients");
    await page.locator("#aiSourceText").fill("UJI_PENERIMA_BARU\nTK UJI BARU");
    await page.getByRole("button", { name: "Baca dan klasifikasikan" }).click();

    const row = page.locator("[data-recipient-row='0']");
    const checkbox = row.locator("[data-include-recipient]");
    assert.equal(await checkbox.isEnabled(), true, "manual completion should allow a review row to be selected");
    for (const field of ["siswa_kecil", "siswa_besar", "tendik", "ibu_hamil", "ibu_menyusui", "balita", "putus_sekolah", "kader"]) {
      const input = row.locator('[data-recipient-field="' + field + '"]');
      assert.equal(await input.inputValue(), "", field + " should remain blank until the user fills it");
      await input.fill("0");
    }
    assert.equal(app.writes.some(item => item.route === "ai/recipient-apply"), false);
    await checkbox.check();
    await page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Konfirmasi & simpan penerima" }).click();
    await page.locator(".ai-status").getByText(/1 baris penerima berhasil disimpan/).waitFor();

    const save = app.writes.find(item => item.route === "ai/recipient-apply");
    assert.ok(save);
    assert.equal(save.body.expected, null);
    for (const field of ["siswa_kecil", "siswa_besar", "tendik", "ibu_hamil", "ibu_menyusui", "balita", "putus_sekolah", "kader"]) {
      assert.equal(save.body.data[field], 0, field + " should only become zero after explicit manual entry");
    }
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});


test("P2 archive separates list, detail, print actions, and dangerous bulk deletion", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="archive"]').click();
    await page.locator("#docsDaysList .docs-day-card").waitFor();
    const danger = page.locator(".docs-danger-zone");
    await danger.getByText("Area berbahaya · Penghapusan riwayat").waitFor();
    assert.equal(await danger.locator("#docsDaysDelete").isVisible(), true);
    await page.locator("#docsDaysList .docs-day-card .docs-btn.primary").click();
    await page.locator(".docs-distribution-detail").waitFor();
    await page.getByRole("heading", { name: "Detail Distribusi" }).waitFor();
    assert.equal(await page.locator(".docs-print-area").isVisible(), true);
    assert.equal(await page.locator(".docs-danger-zone").count(), 0, "destructive actions should not appear in a distribution detail context");
    await page.getByRole("button", { name: "Kembali ke daftar distribusi" }).click();
    await page.locator("#docsDaysList .docs-day-card").waitFor();
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});

test("P2 Data Master CSV preview requires a separate explicit import confirmation", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="master"]').click();
    await page.locator(".dm-data-row").waitFor();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Impor CSV" }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: "penerima-uji.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("kelompok,nama,jenjang,siswa kecil,siswa besar\nSekolah/Lembaga,SDN CSV UJI,SD,10,6")
    });
    await page.locator(".dm-import-preview").waitFor();
    assert.equal(await page.getByText("SDN CSV UJI", { exact: true }).isVisible(), true);
    assert.equal(app.writes.some(item => item.route === "master/import"), false, "parsing and preview must not write");
    await page.getByRole("button", { name: "Konfirmasi impor 1 baris" }).click();
    await page.locator(".dm-msg").getByText(/baris penerima berhasil diimpor/).waitFor();
    const request = app.writes.find(item => item.route === "master/import");
    assert.ok(request);
    assert.equal(request.body.rows.length, 1);
    assert.equal(request.body.rows[0].nama, "SDN CSV UJI");
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});

test("P2 Menu section quick action opens AI directly in menu mode and shows a review queue", async () => {
  const app = await openApp();
  try {
    const page = app.page;
    await page.locator('[data-home-nav="print"]').click();
    await page.locator("#docsCreateForm").waitFor();
    await page.getByRole("button", { name: "Bantu isi dengan AI" }).click();
    await page.locator(".dm-dialog").waitFor();
    assert.equal(await page.locator(".docs-overlay").evaluate(element => element.inert), true, "the underlying document workspace should be inert while the AI dialog is open");
    assert.equal(await page.locator("#aiMode").inputValue(), "menus");
    await page.locator("#aiSourceText").fill("SDN UJI BROWSER: Nasi Putih, Ayam Kecap");
    await page.getByRole("button", { name: "Baca dan klasifikasikan" }).click();
    await page.getByRole("heading", { name: "Antrean pemeriksaan" }).waitFor();
    await page.getByText("Menunggu pemeriksaan", { exact: true }).waitFor();
    assert.equal(await page.locator(".ai-review-queue-count").textContent(), "1 usulan");
    assert.equal(app.writes.some(item => item.route === "docs/create"), false);
    await page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Terapkan menu ke Buat Dokumen" }).click();
    await page.locator("#docsCreateForm").waitFor();
    assert.equal(await page.locator(".docs-overlay").evaluate(element => element.inert), false, "the document workspace should be restored after applying the AI plan");
    assert.equal(await page.locator("input[name='recipient']").isChecked(), true);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});

test("P2 archive and Data Master expose loading and recoverable error states", async () => {
  const delayed = await openApp({ apiDelays: { "docs/days": 300 } });
  try {
    const page = delayed.page;
    await page.locator('[data-home-nav="archive"]').click();
    await page.locator("#docsDaysList[data-state='loading']").waitFor();
    await page.locator("#docsDaysList .docs-day-card").waitFor();
    assert.equal(await page.locator("#docsDaysList").getAttribute("data-state"), "success");
  } finally {
    await delayed.context.close();
  }

  const failed = await openApp({ apiFailures: { "docs/days": 1 } });
  try {
    const page = failed.page;
    await page.locator('[data-home-nav="archive"]').click();
    await page.locator(".docs-archive-error").waitFor();
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await page.locator("#docsDaysList .docs-day-card").waitFor();
    assert.equal(await page.locator("#docsDaysList").getAttribute("data-state"), "success");
    assert.deepEqual(failed.errors, []);
  } finally {
    await failed.context.close();
  }
});

test("P3 responsive and keyboard audit covers the five required viewports and captures evidence", async () => {
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 }
  ];
  await mkdir("test-results/p2-p3", { recursive: true });

  for (const viewport of viewports) {
    const app = await openApp({ viewport });
    try {
      const page = app.page;
      if (viewport.width <= 720) await page.locator("#homeMenuToggle").click();
      const masterTrigger = page.locator('[data-home-nav="master"]');
      await masterTrigger.click();
      await page.locator(".dm-data-row").waitFor();

      const mobile = viewport.width <= 820;
      assert.equal(await page.locator("#dmCategorySelect").isVisible(), mobile, "category selector visibility at " + viewport.width);
      if (mobile) {
        assert.equal(await page.locator(".dm-tabs button").first().isVisible().catch(() => false), false);
        assert.equal(await page.locator(".dm-table[data-mobile-cards='true'] tr.dm-data-row").evaluate(row => getComputedStyle(row).display), "grid");
      } else {
        assert.equal(await page.locator(".dm-tabs button").first().isVisible(), true);
        assert.equal(await page.locator(".dm-tabs").evaluate(nav => getComputedStyle(nav).flexDirection), "column");
      }

      await page.getByRole("button", { name: "+ Tambah" }).click();
      assert.equal(await page.locator(".dm-form-group").count(), 3, "recipient form should be grouped into identity, quantities and verification");
      await page.getByRole("button", { name: "Batal" }).click();

      const masterScroll = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      assert.ok(masterScroll.width <= masterScroll.viewport + 1, "Data Master must not overflow horizontally at " + viewport.width);
      await page.screenshot({ path: "test-results/p2-p3/master-" + viewport.width + "x" + viewport.height + ".png", fullPage: true });

      await page.keyboard.press("Shift+Tab");
      assert.ok(await page.locator(".dm-dialog").evaluate(dialog => dialog.contains(document.activeElement)), "keyboard focus must remain in Data Master dialog");
      await page.keyboard.press("Escape");
      await page.locator(".dm-overlay").waitFor({ state: "hidden" });
      if (viewport.width > 720) assert.equal(await page.evaluate(() => document.activeElement?.dataset?.homeNav), "master", "Escape should restore focus to the navigation trigger");
      if (viewport.width <= 720) await page.locator("#homeMenuToggle").click();

      await page.locator('[data-home-nav="archive"]').click();
      await page.locator("#docsDaysList .docs-day-card").waitFor();
      await page.locator("#docsDaysList .docs-day-card .docs-btn.primary").click();
      await page.locator("#docsList").waitFor();
      await page.getByRole("button", { name: "Input realisasi" }).click();
      await page.locator(".docs-portion-comparison").waitFor();
      await page.locator(".docs-realization-confirmation").waitFor();
      const pageScroll = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      assert.ok(pageScroll.width <= pageScroll.viewport + 1, "BAST realization must not overflow horizontally at " + viewport.width);
      const portionColumns = await page.locator(".docs-portion-comparison").evaluate(element => getComputedStyle(element).gridTemplateColumns);
      assert.ok(portionColumns.split(" ").length >= 1);
      await page.screenshot({ path: "test-results/p2-p3/bast-" + viewport.width + "x" + viewport.height + ".png", fullPage: true });

      assert.deepEqual(app.errors, [], "no browser runtime errors at " + viewport.width);
    } finally {
      await app.context.close();
    }
  }
});


test("P3 Data Master loading and error states recover without losing the selected category", async () => {
  const delayed = await openApp({ apiDelays: { "master/list": 300 } });
  try {
    const page = delayed.page;
    await page.locator('[data-home-nav="master"]').click();
    await page.locator(".dm-table-wrap[data-state='loading']").waitFor();
    await page.locator(".dm-data-row").waitFor();
    assert.equal(await page.locator(".dm-table-wrap").getAttribute("data-state"), "success");
  } finally {
    await delayed.context.close();
  }

  const failed = await openApp({ apiFailures: { "master/list": 1 } });
  try {
    const page = failed.page;
    await page.locator('[data-home-nav="master"]').click();
    await page.locator(".dm-load-error").waitFor();
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await page.locator(".dm-data-row").waitFor();
    assert.equal(await page.locator(".dm-table-wrap").getAttribute("data-state"), "success");
    assert.equal(await page.locator("#dmCategorySelect").inputValue(), "recipients");
    assert.deepEqual(failed.errors, []);
  } finally {
    await failed.context.close();
  }
});

test("P3 AI loading and error states preserve the source and support retry into the review queue", async () => {
  const app = await openApp({ apiFailures: { "ai/analyze": 1 }, apiDelays: { "ai/analyze": 250 } });
  try {
    const page = app.page;
    await page.locator('[data-home-nav="master"]').click();
    await page.getByRole("button", { name: "Asisten AI" }).click();
    await page.locator("#aiSourceText").fill("SDN UJI BROWSER: Nasi Putih, Ayam Kecap");
    await page.getByRole("button", { name: "Baca dan klasifikasikan" }).click();
    await page.locator(".ai-status[data-state='loading']").waitFor();
    await page.locator(".ai-status[data-state='error']").waitFor();
    assert.equal(await page.locator("#aiSourceText").inputValue(), "SDN UJI BROWSER: Nasi Putih, Ayam Kecap");
    await page.getByRole("button", { name: "Baca dan klasifikasikan" }).click();
    await page.getByRole("heading", { name: "Antrean pemeriksaan" }).waitFor();
    assert.equal(await page.locator(".ai-review-queue").getAttribute("aria-labelledby"), "aiReviewQueueTitle");
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});
