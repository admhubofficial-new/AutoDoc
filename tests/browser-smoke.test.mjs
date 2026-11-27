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

async function openApp({ authenticated = true, viewport = { width: 1365, height: 900 }, apiFailures = {}, apiDelays = {}, recipientCount = 1, initialPlans = [], lockedDistribution = null, transportDefaults = {nama_pengemudi:"Budi Supriadi / Elzar Rifandanu",no_kendaraan:"Z 8734 HS / Z 8952 AI"} } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const writes = [];
  const errors = [];
  const menuPlans=new Map(initialPlans.map(plan=>[plan.tanggal,plan]));
  page.on("pageerror", error => errors.push(error.message));

  await page.route("**/functions/v1/autodoc-auth/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const routeName = url.pathname.split("/autodoc-auth/")[1] || "";
    if (apiDelays[routeName]) await new Promise(resolve => setTimeout(resolve, apiDelays[routeName]));
    const failureKey = routeName==="menus/plans"&&url.searchParams.has("tanggal")?"menus/plans?date":url.searchParams.has("preview") ? routeName + "?preview=true" : routeName === "master/list" && url.searchParams.has("include_recipients")
      ? "master/list?include_recipients=false"
      : routeName;
    if (apiFailures[failureKey] > 0) {
      apiFailures[failureKey] -= 1;
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
      payload = { data: { settings: [{ kode_sppg:"SPPG-UJI", nama_kepala_sppg: "Kepala SPPG", nama_kepala_sppi: "Kepala SPPI", nama_ahli_gizi: "Ahli Gizi" }], recipients: [{
        id: recipientId, nama: "SDN UJI BROWSER", kelompok: "Sekolah/Lembaga", jenjang: "SD", alamat: "Alamat Uji",
        aktif: true, urutan: 10, total_porsi: 16, siswa_kecil: 16, siswa_besar: 0, tendik: 0,
        ibu_hamil: 0, ibu_menyusui: 0, balita: 0, putus_sekolah: 0, kader: 0
      }], staff: [], drivers: [{id:"driver-1",nama:"Budi Supriadi",aktif:true,urutan:10,default_pengiriman:true},{id:"driver-2",nama:"Elzar Rifandanu",aktif:true,urutan:20,default_pengiriman:true}], vehicles: [{id:"vehicle-1",no_kendaraan:"Z 8734 HS",aktif:true,urutan:10,default_pengiriman:true},{id:"vehicle-2",no_kendaraan:"Z 8952 AI",aktif:true,urutan:20,default_pengiriman:true}], transport_defaults:transportDefaults, menus: [], numbering:[{jenis:"SJ",start_number:1000,next_number:1053,locked:true},{jenis:"BAST",start_number:1000,next_number:1055,locked:true}] } };
    } else if (routeName === "master/numbering") {
      writes.push({route:routeName,body:request.postDataJSON()});payload={success:true};
    } else if (routeName === "master/recipients") {
      payload = { recipients: [{
        id: recipientId, nama: "SDN UJI BROWSER", kelompok: "Sekolah/Lembaga", jenjang: "SD",
        total_porsi: 16, siswa_kecil: 16, balita: 0, siswa_besar: 0, tendik: 0,
        ibu_hamil: 0, ibu_menyusui: 0, putus_sekolah: 0, kader: 0
      }] };
    } else if (routeName === "menus/plans") {
      if(request.method()==="POST"){const body=request.postDataJSON();writes.push({route:routeName,body});const saved=body.plans.map(plan=>({...plan,updated_at:new Date().toISOString()}));for(const plan of saved)menuPlans.set(plan.tanggal,plan);payload={success:true,plans:saved}}
      else{const date=url.searchParams.get("tanggal");payload={plans:[...menuPlans.values()].filter(plan=>!date||date===plan.tanggal),distribution:date===lockedDistribution?.tanggal?lockedDistribution:null,has_more:false}}
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

    const recipients = payload.data?.recipients || payload.recipients;
    if (recipients?.length && recipientCount > 1) {
      for (let index = 1; index < recipientCount; index++) {
        recipients.push({ ...recipients[0], id: recipientId.slice(0, -2) + String(index).padStart(2, "0"), nama: "Tujuan " + (index + 1) });
      }
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
    assert.equal(await page.locator("#homeMenuToggle").isVisible(),false);
    assert.equal(await page.locator("#homeNav").evaluate(el=>getComputedStyle(el).flexDirection),"row");

    await page.locator('[data-home-nav="print"]').click();
    await page.locator("#docsCreateForm").waitFor();
    await page.locator(".docs-recipient").waitFor();
    for (const id of ["docsStaff", "docsDriver", "docsVehicle"]) {
      assert.equal(await page.locator("#" + id).getAttribute("required"), null);
    }
    await page.locator("#docsShippingDisclosure > summary").click();
    await page.locator("input[name='recipient']").check();
    const preview = page.frameLocator("#docsPreviewFrame").locator("body");
    await preview.getByText(/1053\/SJ\/SPPG-UJI\//).waitFor();
    await page.locator("#docsDriver").fill("Pengemudi Browser Test");
    await preview.getByText("Pengemudi Browser Test", { exact: false }).waitFor();
    assert.equal(app.writes.some(item => item.route === "docs/create"), false);
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }

  const mobile = await openApp({ viewport: { width: 390, height: 844 } });
  try {
    await mobile.page.locator("#homeMenuToggle").click();
    await mobile.page.locator('[data-home-nav="print"]').click();
    await mobile.page.locator("#docsCreateForm").waitFor();
    await mobile.page.locator("input[name='recipient']").check();
    assert.match(await mobile.page.locator("#docsSubmitCount").textContent(), /1 tujuan · 16 porsi/);
    assert.match(await mobile.page.locator("#docsOutputCount").textContent(),/^2 surat/);
    await mobile.page.locator("#docsKindBast").uncheck();
    assert.match(await mobile.page.locator("#docsOutputCount").textContent(),/^1 surat/);
    assert.equal(await mobile.page.locator("#docsKindSj").isChecked(),true);
    await mobile.page.locator("#homeMenuToggle").click();
    await mobile.page.locator("#homePage.mobile-nav-open").waitFor();
    await mobile.page.locator('[data-home-nav="archive"]').click();
    await mobile.page.locator("#homePage:not(.mobile-nav-open)").waitFor();
    await mobile.page.locator("#docsDaysList").waitFor();
    assert.equal(await mobile.page.locator('[data-home-nav="archive"]').getAttribute("aria-current"),"page");
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
    assert.equal((await context.textContent()).trim(), "Buat Dokumen");
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
    assert.equal(await page.locator("#workspacePages .docs-overlay").count(),1);
    assert.equal(await page.locator('[data-home-nav="realization"]').isVisible(),true);
    await page.locator("input[name='recipient']").waitFor();
    await page.locator("input[name='recipient']").check();
    await page.locator("#docsMealTime").selectOption("pagi");
    await page.locator('[data-home-nav="realization"]').click();
    await page.locator("#docsRealizationQueue").getByRole("button",{name:"Input realisasi"}).waitFor();
    assert.equal(await page.locator("#docsPrintBulk").isVisible(),false);
    assert.equal((await context.textContent()).trim(),"Realisasi BAST");
    await page.locator('[data-home-nav="print"]').click();
    await page.locator("#docsCreateForm").waitFor();
    assert.equal(await page.locator("#docsMealTime").inputValue(),"pagi");
    assert.equal(await page.locator("input[name='recipient']").isChecked(),true);
    assert.equal(await page.locator("style").count(), 0);
    await page.locator('[data-home-nav="home"]').click();
    await page.locator(".docs-overlay").waitFor({ state: "hidden" });
    await page.locator('[data-home-nav="master"]').click();
    await page.locator(".dm-overlay:not([hidden])").waitFor();
    assert.equal((await context.textContent()).trim(), "Data Master");
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
    await page.locator("#docsCreateForm").waitFor();
    await page.locator('[data-home-nav="home"]').click();
    await page.locator(".home-operator-hero").waitFor();
    assert.equal(await page.locator("#opsDashboard").getAttribute("data-state"), "success");
    assert.notEqual((await page.locator(".home-operational-date").getAttribute("datetime")) || "", "");
    assert.equal((await page.locator(".home-bast-count").textContent()).trim(), "2");
    assert.equal(await page.locator(".home-master-check").isVisible(), true);
    assert.equal(await page.locator(".home-archive-card").isVisible(), true);

    await page.locator('[data-dashboard-action="create"]').click();
    await page.locator("#docsCreateForm").waitFor();
    assert.equal(await page.locator("#docsCreateForm .docs-form-section-head").count(), 0);
    assert.equal(await page.locator("#docsPreviewDisclosure").isVisible(), true);
    const previewLayout = await page.evaluate(() => {
      const layout = document.querySelector(".docs-create-layout");
      const form = document.querySelector(".docs-create-form-panel");
      const preview = document.querySelector("#docsPreviewDisclosure");
      const formRect = form.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      return {
        display: getComputedStyle(layout).display,
        columns: getComputedStyle(layout).gridTemplateColumns.trim().split(/\s+/).length,
        position: getComputedStyle(preview).position,
        beside: previewRect.left >= formRect.right - 1
      };
    });
    assert.equal(previewLayout.display, "grid");
    assert.equal(previewLayout.columns, 2);
    assert.equal(previewLayout.position, "static");
    assert.equal(previewLayout.beside, true);
    assert.equal(await page.locator("#docsShippingDisclosure").evaluate(element => element.open), false);
    assert.equal(await page.locator("#docsCreateButton").isDisabled(), false);
    assert.equal(await page.locator("#docsIncludeOrganoleptic").isChecked(), true);
    assert.equal(await page.locator("#docsTime").inputValue(), "");
    assert.equal(await page.locator("input[name='recipient']").isChecked(), true);
    const summary = await page.locator("#docsPreflightSummary").innerText();
    assert.match(summary, /Menu harian belum diisi/);
    assert.match(await page.locator("#docsSubmitCount").textContent(), /1 tujuan/);
    assert.match(await page.locator("#docsSubmitCount").textContent(), /16 porsi/);
    assert.equal(await page.locator("#docsCreateButton").isDisabled(), false);
    await page.locator("#docsRecipientGroup").selectOption("Sekolah/Lembaga");
    assert.equal(await page.locator(".docs-recipient:visible").count(), 1);
    const preview = page.frameLocator("#docsPreviewFrame").locator("body");
    await preview.locator(".meta-table td").filter({ hasText: "SDN UJI BROWSER" }).waitFor();
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
    await page.locator("#docsCreateForm").waitFor();
    assert.equal(await page.locator("#docsPreviewDisclosure").isVisible(), false);
    const recipientTools = page.locator(".docs-recipient-tools");
    assert.equal(await recipientTools.evaluate(element => getComputedStyle(element).position), "static");
    assert.equal(await page.locator("#docsRecipientList").evaluate(element => getComputedStyle(element).overflowY), "visible");
    await page.locator("input[name='recipient']").check();
    assert.match(await page.locator("#docsSubmitCount").textContent(), /16 porsi/);
    await page.locator("#docsPreviewToggle").click();
    assert.equal(await page.locator("#docsPreviewDisclosure").isVisible(), true);
    await page.locator("#docsEditToggle").click();
    assert.equal(await page.locator("input[name=recipient]").isChecked(), true);
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
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith("/docs/realization") && response.request().method() === "POST"),
      page.getByRole("button", { name: "Simpan realisasi" }).click()
    ]);

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
      assert.equal(await page.locator(".dm-dialog").getAttribute("role"), "region", "Data Master is a page, not a modal");
      await page.locator(".dm-close").focus();
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



test("phase 3 distribution draft survives reload, can be discarded, and never issues documents", async () => {
 const app=await openApp();
 try{
  const page=app.page;
  await page.locator('[data-home-nav="print"]').click();
  await page.locator("input[name='recipient']").check();
  await page.locator("#docsMealTime").selectOption("pagi");
  await page.locator("#docsAddMenuItem").click();
  await page.locator(".docs-menu-input").fill("Nasi uji draf");
  await page.locator("#docsDraftStatus").getByText(/Draf tersimpan/).waitFor();
  await page.reload({waitUntil:"domcontentloaded"});
  await page.locator('[data-home-nav="print"]').click();
  await page.locator("input[name='recipient']").waitFor();
  assert.equal(await page.locator("#docsMealTime").inputValue(),"pagi");
  assert.equal(await page.locator("input[name='recipient']").isChecked(),true);
  assert.equal(await page.locator(".docs-menu-input").inputValue(),"Nasi uji draf");
  assert.equal(app.writes.some(item=>item.route==="docs/create"),false);
  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#docsDiscardDraft").click();
  assert.equal(await page.locator("input[name='recipient']").isChecked(),true);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem("autodoc:distribution-draft:v1")),null);
  await page.locator("input[name='recipient']").check();
  await page.locator("#logoutButton").click();
  await page.locator("#loginPanel:not([hidden])").waitFor();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem("autodoc:distribution-draft:v1")),null);
  assert.deepEqual(app.errors,[]);
 }finally{await app.context.close()}
});

test("phase 3 all-date BAST queue uses archived dates and opens the existing realization form", async () => {
 const app=await openApp();
 try{
  const page=app.page;
  await page.locator('[data-home-nav="home"]').click();
  await page.getByRole("button",{name:"Lihat semua BAST tertunda"}).click();
  const queue=page.locator("#docsRealizationQueue");
  await queue.getByText("2026-11-23",{exact:false}).waitFor();
  assert.match(await page.locator(".workspace-queue-totals").textContent(),/1 BAST belum diisi/);
  await queue.getByRole("button",{name:"Input realisasi"}).click();
  await page.locator(".docs-realization").waitFor();
  assert.equal(await page.locator("#docsHistoryDate").inputValue(),"2026-11-23");
  assert.equal(app.writes.some(item=>item.route==="docs/realization"),false);
  assert.deepEqual(app.errors,[]);
 }finally{await app.context.close()}
});


test("phase 3 BAST history scan retries without claiming incomplete history is complete", async () => {
 const app=await openApp({apiFailures:{"docs/list":1}});
 try{
  const page=app.page;
  await page.locator('[data-home-nav="home"]').click();
  await page.getByRole("button",{name:"Lihat semua BAST tertunda"}).click();
  const more=page.getByRole("button",{name:"Coba lagi",exact:true});
  await more.waitFor();
  assert.match(await page.locator(".workspace-queue-totals").textContent(),/riwayat belum selesai/);
  await more.click();
  await page.locator("#docsRealizationQueue").getByRole("button",{name:"Input realisasi"}).waitFor();
  assert.match(await page.locator(".workspace-queue-totals").textContent(),/1 tanggal diperiksa/);
  assert.deepEqual(app.errors,[]);
 }finally{await app.context.close()}
});


test("phase 4 groups administration categories and keeps identity editing accessible", async () => {
 const app=await openApp();
 try{
  const page=app.page;
  await page.locator('[data-home-nav="master"]').click();
  await page.locator(".dm-data-row").waitFor();
  assert.equal(await page.locator("#dmCategorySelect optgroup").count(),2);
  await page.getByRole("button",{name:"Identitas SPPG",exact:true}).click();
  assert.equal(await page.locator(".dm-form-group").count(),3);
  assert.equal(await page.locator(".dm-table-wrap").isVisible(),false);
  await page.locator("#dmField_nama_kepala_sppg").fill("Belum disimpan");
  await page.getByRole("button",{name:"Batal",exact:true}).click();
  assert.equal(await page.locator("#dmField_nama_kepala_sppg").inputValue(),"Kepala SPPG");
  await page.getByRole("button",{name:"Penerima manfaat",exact:true}).click();
  await page.locator(".dm-data-row").waitFor();
  assert.equal(app.writes.some(item=>item.route==="master/save"),false);
  assert.deepEqual(app.errors,[]);
 }finally{await app.context.close()}
 const mobile=await openApp({viewport:{width:390,height:844}});
 try{
  const page=mobile.page;
  await page.locator("#homeMenuToggle").click();
  await page.locator('[data-home-nav="master"]').click();
  await page.locator(".dm-data-row").waitFor();
  assert.equal(await page.locator("#dmCategorySelect").isVisible(),true);
  await page.locator("#dmCategorySelect").selectOption("settings");
  assert.equal(await page.locator(".dm-form-group").count(),3);
  assert.equal(await page.locator(".dm-table-wrap").isVisible(),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  assert.deepEqual(mobile.errors,[]);
 }finally{await mobile.context.close()}
});


test("audit: history print controls stay disabled until the selected date has loaded", async () => {
 const app=await openApp({apiDelays:{"docs/list":400}});
 try{
  const page=app.page;
  await page.evaluate(()=>window.AutoDocOpenArchive("2026-11-23"));
  await page.locator("#docsPrintBast:not([disabled])").waitFor();
  await page.locator("#docsHistoryDate").fill("2026-11-24");
  await page.locator("#docsLoadHistory").click();
  assert.equal(await page.locator("#docsPrintBast").isDisabled(),true);
  assert.equal(await page.locator("#docsPrintOrganoleptic").isDisabled(),true);
  await page.locator("#docsPrintBast:not([disabled])").waitFor();
  assert.deepEqual(app.errors,[]);
 }finally{await app.context.close()}
});
test("audit: leaving archive clears PIN confirmation and pending requests cannot replace the current page", async () => {
 const app=await openApp({apiDelays:{"docs/days":250}});
 try{
  const page=app.page;
  await page.locator('[data-home-nav="archive"]').click();
  await page.locator("#docsDaysList .docs-day-card").waitFor();
  await page.locator("#docsDaysSelectAll").check();
  await page.locator("#docsDaysDelete").click();
  await page.locator("#docsDeletePin").fill("pin-test-only");
  page.once("dialog",dialog=>dialog.accept());
  await page.locator('[data-home-nav="print"]').click();
  assert.equal(await page.locator("#docsDeletePin").count(),0);
  await page.locator("input[name='recipient']").waitFor();
  assert.equal(app.writes.some(item=>item.route==="docs/delete-history"),false);
  assert.deepEqual(app.errors,[]);
 }finally{await app.context.close()}
});



test("v3 number configuration requires explicit PIN and confirmation", async () => {
 const app=await openApp();
 try{
  const page=app.page;
  await page.locator('[data-home-nav="master"]').click();
  await page.locator(".dm-data-row").waitFor();
  await page.getByRole("button",{name:"Nomor dokumen",exact:true}).click();
  assert.equal(await page.locator("#numberNext_SJ").inputValue(),"1053");
  assert.equal(await page.locator("#numberNext_BAST").inputValue(),"1055");
  await page.locator("#numberNext_SJ").fill("1052");
  assert.equal(await page.locator("#numberNext_SJ").evaluate(input=>input.checkValidity()),false);
  await page.locator("#numberNext_SJ").fill("1100");
  await page.locator("#numberPin_SJ").fill("123456");
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Simpan nomor SJ"}).click();
  await page.waitForFunction(()=>document.querySelector(".dm-msg")?.textContent.includes("Nomor berikutnya berhasil"));
  assert.deepEqual(app.writes.find(item=>item.route==="master/numbering").body,{jenis:"SJ",next_number:1100,token:"123456"});
  assert.deepEqual(app.errors,[]);
 }finally{await app.context.close()}
});

test("desktop paper accepts wheel input and reflows into scrollable rows on zoom", async () => {
  const app = await openApp({ viewport: { width: 1440, height: 900 }, recipientCount: 21 });
  try {
    const page = app.page;
    const host = page.locator("#docsPreviewPages");
    await host.locator("iframe").nth(6).waitFor({ state: "attached" });
    await page.waitForFunction(() => document.querySelector("#docsPreviewPages")?.getAttribute("aria-busy") === "false");
    const paper = host.locator(".docs-preview-paper").first();
    const box = await paper.boundingBox();
    await page.mouse.move(box.x + 80, box.y + 80);
    await page.mouse.wheel(0, 520);
    await page.waitForFunction(() => document.querySelector("#docsPreviewPages").scrollTop > 100);
    const zoom = page.locator("#docsZoom");
    const nav = page.locator(".docs-page-controls");
    const [navBox, zoomBox] = await Promise.all([nav.boundingBox(), zoom.boundingBox()]);
    assert.ok(navBox && zoomBox, "toolbar controls are visible");
    assert.ok(Math.abs(navBox.y + navBox.height / 2 - zoomBox.y - zoomBox.height / 2) <= 2, "destination navigation and zoom share a row");
    assert.ok(navBox.x + navBox.width <= zoomBox.x, "toolbar controls do not overlap");
    await zoom.press("Home");
    assert.equal(await zoom.inputValue(), "25");
    await page.waitForFunction(() => {
      const pages = document.querySelector("#docsPreviewPages");
      const [a, b] = pages.children;
      const renderedWidth = a.querySelector("iframe").getBoundingClientRect().width;
      return a.clientWidth <= 200 && Math.abs(renderedWidth - a.clientWidth) <= 1 && Math.abs(a.getBoundingClientRect().top - b.getBoundingClientRect().top) <= 1 && b.offsetLeft > a.offsetLeft && pages.children[5].getBoundingClientRect().top >= a.getBoundingClientRect().bottom && a.clientHeight >= a.clientWidth * 1.4 && pages.scrollHeight > pages.clientHeight;
    });
    assert.deepEqual(app.errors, []);
  } finally {
    await app.context.close();
  }
});


test("preview does not render an unselected document kind", async () => {
  const app=await openApp();
  try {
    const page=app.page;await page.locator('[data-home-nav="print"]').click();await page.locator("input[name=recipient]").waitFor();
    await page.locator("#docsPreviewPages .docs-document-sheet").first().waitFor({state:"attached"});
    for (const id of ["docsKindSj","docsKindBast","docsIncludeOrganoleptic"]) await page.locator("#"+id).uncheck();
    await page.waitForFunction(()=>document.querySelectorAll("#docsPreviewPages .docs-document-sheet").length===0 && document.querySelector("#docsPreviewPages").getAttribute("aria-busy")==="false");
    assert.equal(await page.locator("[data-page-step='1']").isDisabled(),true);
    await page.locator("#docsKindSj").check();
    await page.locator("#docsPreviewPages .docs-document-sheet").first().waitFor({state:"attached"});
    assert.deepEqual(app.errors,[]);
  } finally {await app.context.close()}
});


test("daily menu planner isolates dates and saves a batch without issuing documents", async()=>{
 const app=await openApp();try{const page=app.page;await page.locator('[data-home-nav="print"]').click();await page.locator("input[name='recipient']").waitFor();
 const today=await page.locator("#docsDate").inputValue();const nextDate=new Date(today+"T00:00:00Z");nextDate.setUTCDate(nextDate.getUTCDate()+1);const tomorrow=nextDate.toISOString().slice(0,10);
 await page.locator("#docsAddMenuItem").click();await page.locator(".docs-menu-input").fill("Menu hari ini");await page.locator("#docsSaveDailyMenu").click();await page.locator("#docsDailyStatus").getByText(/tersimpan/).waitFor();
 await page.locator("#docsMenuDate").fill(tomorrow);await page.waitForFunction(()=>document.querySelector("#docsDate").value===document.querySelector("#docsMenuDate").value&&!document.querySelector(".docs-menu-input"));
 await page.locator("#docsPlannerMode").click();await page.locator("#docsAddPlanDate").click();await page.locator(".daily-plan-date").last().fill(tomorrow);await page.locator(".daily-plan-menu").last().fill("Nasi; Ayam");page.once("dialog",dialog=>dialog.accept());await page.locator("#docsSavePlans").click();await page.locator("#docsPlannerStatus").getByText(/tersimpan/).waitFor();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll("#docsMenuItems .docs-menu-input"),input=>input.value).join(", ")==="Nasi, Ayam");assert.equal(await page.locator(".daily-active-menu, .daily-menu-note").count(),0);assert.equal(app.writes.some(w=>w.route==="docs/create"),false);assert.deepEqual(app.errors,[]);
 }finally{await app.context.close()}
});


test("new distribution uses editable transport defaults", async()=>{
 const app=await openApp();try{
  const page=app.page;await page.locator('[data-home-nav="print"]').click();await page.locator("input[name=recipient]").waitFor();
  await page.locator("#docsShippingDisclosure > summary").click();
  assert.equal(await page.locator("#docsDriver").inputValue(),"Budi Supriadi / Elzar Rifandanu");
  assert.equal(await page.locator("#docsVehicle").inputValue(),"Z 8734 HS / Z 8952 AI");
  await page.locator("#docsDriver").fill("Budi Supriadi");await page.locator("#docsVehicle").fill("Z 8734 HS");
  assert.equal(await page.locator("#docsDriver").inputValue(),"Budi Supriadi");assert.equal(await page.locator("#docsVehicle").inputValue(),"Z 8734 HS");
  assert.equal(app.writes.some(w=>w.route==="docs/create"),false);assert.deepEqual(app.errors,[]);
 }finally{await app.context.close()}
});


test("legacy draft with empty transport fields migrates to defaults in live Surat Jalan preview", async()=>{
 const app=await openApp();try{
  const page=app.page;
  await page.evaluate(recipientId=>sessionStorage.setItem("autodoc:distribution-draft:v1",JSON.stringify({version:1,savedAt:Date.now(),fields:[["docsDriver",""],["docsVehicle",""],["docsMealTime","pagi"]],menu:["Nasi Putih"],recipients:[recipientId]})),recipientId);
  await page.reload({waitUntil:"domcontentloaded"});await page.locator('[data-home-nav="print"]').click();
  await page.locator("input[name=recipient]").waitFor();
  const preview=page.frameLocator("#docsPreviewFrame").locator("body");
  await preview.getByText("Budi Supriadi / Elzar Rifandanu",{exact:false}).waitFor();
  await preview.getByText("Z 8734 HS / Z 8952 AI",{exact:false}).waitFor();
  assert.equal(await page.locator("#docsDriver").inputValue(),"Budi Supriadi / Elzar Rifandanu");
  assert.equal(await page.locator("#docsVehicle").inputValue(),"Z 8734 HS / Z 8952 AI");
  assert.equal(await page.locator("#docsMealTime").inputValue(),"pagi");
  assert.equal(await page.locator(".docs-menu-input").inputValue(),"Nasi Putih");
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("autodoc:distribution-draft:v1")).version),4);
  await page.locator("#docsShippingDisclosure > summary").click();
  await page.locator("#docsDriver").fill("Pengemudi khusus");await preview.getByText("Pengemudi khusus",{exact:false}).waitFor();
  await page.locator("#docsVehicle").fill("");
  await page.reload({waitUntil:"domcontentloaded"});await page.locator('[data-home-nav="print"]').click();await page.locator("input[name=recipient]").waitFor();
  assert.equal(await page.locator("#docsDriver").inputValue(),"Pengemudi khusus");assert.equal(await page.locator("#docsVehicle").inputValue(),"");
  assert.equal(app.writes.some(w=>w.route==="docs/create"),false);assert.deepEqual(app.errors,[]);
 }finally{await app.context.close()}
});


test("P0: failed date context blocks issuance and retry restores the menu",async()=>{
 const app=await openApp({apiFailures:{"menus/plans?date":1}});try{const page=app.page;await page.locator('[data-home-nav="print"]').click();await page.locator("input[name=recipient]").waitFor();await page.locator("#docsMenuRetry").waitFor();assert.equal(await page.locator("#docsCreateButton").isDisabled(),true);assert.equal(await page.locator("#docsAddMenuItem").isDisabled(),true);await page.locator("#docsMenuRetry").click();await page.waitForFunction(()=>!document.querySelector("#docsAddMenuItem").disabled);assert.equal(app.writes.some(w=>w.route==="docs/create"),false);assert.deepEqual(app.errors,[])}finally{await app.context.close()}
});
test("P0: a locked date uses archived transport and menu, never stale defaults",async()=>{
 const date="2026-11-23",lockedDistribution={id:distributionId,tanggal:date,menu_items:["Menu arsip"],nama_pengemudi:"Pengemudi arsip",no_kendaraan:"BE 1234 XX",waktu_makan:"pagi",jam_berangkat:"08:00:00"};
 const app=await openApp({lockedDistribution});try{const page=app.page;await page.locator('[data-home-nav="print"]').click();await page.locator("input[name=recipient]").waitFor();await page.locator("#docsMenuDate").fill(date);await page.locator("#docsDailyStatus").getByText(/terkunci/).waitFor();assert.equal(await page.locator("#docsDriver").inputValue(),"Pengemudi arsip");assert.equal(await page.locator("#docsVehicle").inputValue(),"BE 1234 XX");assert.equal(await page.locator("#docsDriver").isDisabled(),true);assert.equal(await page.locator(".docs-menu-input").inputValue(),"Menu arsip");assert.equal(await page.locator("#docsAddMenuItem").isDisabled(),true);assert.equal(app.writes.some(w=>w.route==="docs/create"),false);assert.deepEqual(app.errors,[])}finally{await app.context.close()}
});


test("P1: database defaults replace untouched draft values and preserve manual overrides",async()=>{
 const app=await openApp({transportDefaults:{nama_pengemudi:"Pengemudi DB",no_kendaraan:"Z 2222 AA"}});try{const page=app.page;await page.evaluate(recipientId=>sessionStorage.setItem("autodoc:distribution-draft:v1",JSON.stringify({version:4,savedAt:Date.now(),fields:[["docsDriver","Default lama"],["docsVehicle","Z 1111 AA"]],transportOverrides:{docsDriver:false,docsVehicle:true},menu:[],recipients:[recipientId]})),recipientId);await page.reload({waitUntil:"domcontentloaded"});await page.locator('[data-home-nav="print"]').click();await page.locator("input[name=recipient]").waitFor();await page.waitForFunction(()=>document.querySelector("#docsDriver")?.value==="Pengemudi DB");assert.equal(await page.locator("#docsVehicle").inputValue(),"Z 1111 AA");await page.frameLocator("#docsPreviewFrame").getByText("Pengemudi DB",{exact:false}).waitFor();assert.equal(app.writes.some(w=>w.route==="docs/create"),false);assert.deepEqual(app.errors,[])}finally{await app.context.close()}
});
