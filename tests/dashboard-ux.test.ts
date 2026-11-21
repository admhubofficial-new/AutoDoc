import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("../dashboard.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

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
  assert.match(index, /Ringkasan operasional/);
});

test("primary navigation is a responsive workspace sidebar", () => {
  assert.match(index, /grid-template-columns:248px minmax\(0,1fr\)/);
  assert.match(index, /@media\(max-width:720px\)/);
  assert.match(index, /homeNav/);
  assert.match(index, /sidebar-collapsed/);
  assert.match(index, /mobile-nav-open/);
  assert.match(index, /homeSidebarBackdrop/);
  assert.ok(index.indexOf('<aside class="home-topbar" id="homeSidebar"') < index.indexOf('id="homeMenuToggle"'));
  assert.ok(index.indexOf('id="homeMenuToggle"') < index.indexOf('<nav class="home-nav"'));
  assert.doesNotMatch(index, /<header class="home-pagebar">[\\s]*<button[^>]*home-menu-toggle/);
  assert.ok(index.includes('translateX(calc(-100% + 52px))'));
  assert.match(index, /Ciutkan sidebar/);
  assert.match(index, /window\.matchMedia\("\(max-width: 720px\)"\)/);
  assert.match(index, /Buat Dokumen/);
  assert.match(index, /Arsip/);
  assert.match(index, /Data Master/);
  assert.match(index, /data-home-nav="archive"/);
  assert.match(index, /documents\.js\?v=single-navigation-20261122/);
  assert.match(index, /body \.docs-overlay \.docs-dialog/);
  assert.match(index, /body \.dm-overlay \.dm-dialog/);
});