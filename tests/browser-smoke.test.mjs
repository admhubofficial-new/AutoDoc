import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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

async function openApp({ authenticated = true, viewport = { width: 1365, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const writes = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.route("**/functions/v1/autodoc-auth/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const routeName = url.pathname.split("/autodoc-auth/")[1] || "";
    let payload = {};

    if (routeName === "setup/status") payload = { setupRequired: false };
    else if (routeName === "auth/session") payload = { authenticated };
    else if (routeName === "dashboard/summary") {
      payload = { counts: { distributions: 1, bast_pending: 0 }, recent_distributions: [] };
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
      payload = { distributions: [{
        id: distributionId, tanggal: "2026-11-23", menu: "Nasi, ayam", nama_petugas: "Petugas Uji",
        nama_pengemudi: "Pengemudi Uji", no_kendaraan: "BE 1234 XX"
      }], offset: 0, has_more: false };
    } else if (routeName.startsWith("docs/list")) {
      payload = { distribution: { id: distributionId, tanggal: "2026-11-23", menu: "Nasi, ayam", menu_items: [] }, documents: [] };
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
    await page.locator("input[name='recipient']").check();
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
    await page.locator(".docs-overlay[hidden]").waitFor();
    await page.locator('[data-home-nav="master"]').click();
    await page.locator(".dm-overlay:not([hidden])").waitFor();
    assert.equal((await context.textContent()).trim(), "Data Master");
    await page.getByRole("button", { name: "Asisten AI" }).click();
    assert.equal(await page.locator("style").count(), 0);
    await page.locator(".dm-close").click();
    await page.locator(".dm-overlay[hidden]").waitFor();
    await page.locator('[data-home-nav="archive"]').click();
    await page.locator("#docsDaysList").waitFor();
    assert.equal((await context.textContent()).trim(), "Arsip");
    await page.locator(".docs-close").click();
    await page.locator(".docs-overlay[hidden]").waitFor();
    await page.locator('[data-home-nav="home"]').click();
    await page.locator("#opsDashboard").waitFor();
    assert.equal((await context.textContent()).trim(), "Beranda");
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
