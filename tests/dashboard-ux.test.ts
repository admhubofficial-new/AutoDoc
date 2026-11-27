import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../dashboard.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("dashboard only raises follow-up alerts for actionable data issues", () => {
  assert.match(dashboard, /sppg_missing_fields/);
  assert.match(dashboard, /ahli_gizi_missing/);
  assert.match(dashboard, /recipients_missing_address/);
  assert.match(dashboard, /recipients_need_verification/);
  assert.doesNotMatch(dashboard, /drivers_active|vehicles_active|staff_active|menus_active/);
});

test("dashboard offers direct access to create documents and the archive", () => {
  assert.match(dashboard, /AutoDocOpenDocs/);
  assert.match(dashboard, /AutoDocOpenArchive/);
  assert.doesNotMatch(index, /homeCreateShortcut/);
  assert.match(index, /Ruang kerja/);
});

test("primary navigation supports a horizontal desktop workspace and a mobile drawer", () => {
  assert.match(css, /grid-template-columns:248px minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(index, /homeNav/);
  assert.match(css, /sidebar-collapsed/);
  assert.match(css, /mobile-nav-open/);
  assert.match(index, /homeSidebarBackdrop/);
  assert.ok(index.indexOf('<aside class="home-topbar" id="homeSidebar"') < index.indexOf('id="homeMenuToggle"'));
  assert.ok(index.indexOf('id="homeMenuToggle"') < index.indexOf('<nav class="home-nav"'));
  assert.doesNotMatch(index, /<header class="home-pagebar">[\\s]*<button[^>]*home-menu-toggle/);
  assert.ok(css.includes('translateX(calc(-100% + 52px))'));
  assert.match(index, /Ciutkan sidebar/);
  assert.match(index, /window\.matchMedia\("\(max-width: 720px\)"\)/);
  assert.match(index, /Buat Dokumen/);
  assert.match(index, /Arsip/);
  assert.match(index, /Data Master/);
  assert.match(index, /data-home-nav="archive"/);
  assert.match(index, /documents\.js\?v=[^"]+/);
  assert.match(index, /archive\.js\?v=[^"]+/);
  assert.match(css, /body \.docs-overlay \.docs-dialog/);
  assert.match(css, /body \.dm-overlay \.dm-dialog/);
});
test("dashboard is an operator action center with an operational date, BAST queue, separate master checks, and recent archive", () => {
  for (const selector of ["home-operator-hero", "home-operational-date", "home-bast-queue", "home-master-check", "home-archive-card"]) {
    assert.ok(dashboard.includes(selector), "dashboard should render " + selector);
  }
  assert.match(dashboard, /counts\.bast_pending/);
  assert.match(dashboard, /recent_distributions/);
  assert.match(dashboard, /dashboardAction/);
  assert.match(dashboard, /setState\("loading"\)/);
  assert.match(dashboard, /setState\("error"\)/);
  assert.match(dashboard, /setState\("success"\)/);
  assert.doesNotMatch(dashboard, /drivers_active|vehicles_active|staff_active|menus_active/);
});
