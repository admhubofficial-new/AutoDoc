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
      payload = { data: { settings: [{ nama_kepala_sppg: "Kepala SPPG", nama_kepala_sppi: "Kepala SPPI", nama_ahli_gizi: "Ahli Gizi" }], staff: [], drivers: [], vehicles: [], menus: [] } };
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
    await preview.getByText("Petugas Browser Test").waitFor();
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
