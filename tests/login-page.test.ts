import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const theme = readFileSync(new URL("../theme.css", import.meta.url), "utf8");

test("login page uses a centered single-column layout and BGN logo", () => {
  assert.match(page, /<main id="authPage" class="auth-page" hidden>/);
  assert.match(page, /class="auth-logo"[\s\S]*?width="72"[\s\S]*?height="72"/);
  assert.match(page, /object\/public\/logo%20bgn\/logo-bgn%20\(1\)\.png/);
  assert.doesNotMatch(page, /class="brand-panel"|class="visual-card"|class="brand-benefits"|class="welcome-tag"/);
  assert.match(css, /background:\s*#F6F7F5/);
  assert.match(css, /border:\s*1px solid #E1E6E2/);
  assert.match(css, /border-radius:\s*16px/);
  assert.match(css, /padding:\s*32px/);
  assert.match(css, /width:\s*min\(100%, 400px\)/);
});

test("login form keeps password entry, inline visibility control and inline error feedback", () => {
  assert.match(page, /id="accessToken"[\s\S]*?type="password"[\s\S]*?autofocus/);
  assert.match(page, /id="toggleVisibility"[\s\S]*?>Tampilkan<\/button>/);
  assert.match(page, /toggleButton\.textContent = shouldShow \? "Sembunyikan" : "Tampilkan"/);
  assert.match(page, /id="loginError" class="error-message" role="alert"/);
  assert.match(page, /loginButton\.textContent = "Memeriksa…"/);
  assert.match(page, /loginButton\.disabled = true/);
  assert.match(page, /loginButton\.textContent = "Masuk"/);
  assert.match(page, /tokenInput\.focus\(\)/);
});

test("login, setup, logout and session routes remain unchanged", () => {
  assert.match(page, /postJson\("auth\/login", \{ token \}\)/);
  assert.match(page, /requestJson\("auth\/session"\)/);
  assert.match(page, /postJson\("setup\/complete",/);
  assert.match(page, /postJson\("auth\/logout", \{\}\)/);
  assert.match(page, /if \(error\.status === 409\) showSetup\(\)/);
  assert.match(page, /Lima kali salah memasukkan PIN akan mengunci akses selama 15 menit/);
});

test("workspace styles load from one versioned stylesheet", () => {
  assert.match(page, /<link rel="stylesheet" href="\.\/styles\.css\?v=p0-shell-design-system-20261124">[\s\S]*?<link rel="stylesheet" href="\.\/theme\.css\?v=p0-design-tokens-components-20261124">/);
  assert.doesNotMatch(page, /<style>/);
  assert.match(css, /\.home-page\.sidebar-collapsed\{grid-template-columns:76px minmax\(0,1fr\)\}/);
  assert.match(theme, /Penyegaran visual/);
  assert.match(theme, /body\.auth-pending #authPage/);
  assert.match(theme, /\.home-page\.sidebar-collapsed \.home-nav button/);
  assert.match(css, /\.home-page\.mobile-nav-open \.home-topbar\{transform:translateX\(0\)/);
  assert.match(css, /\.home-sidebar-backdrop\{position:fixed/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("mobile drawer keeps its dedicated spacing at narrow phone widths", () => {
  assert.match(css, /\.home-topbar,\.home-page\.sidebar-collapsed \.home-topbar\{position:fixed[\s\S]*?padding:22px 16px 16px/);
  assert.doesNotMatch(css, /@media \(max-width: 480px\)[\s\S]*?\.home-topbar\s*\{\s*padding:\s*0 16px/);
});


test("authenticated reload never renders the login page before session verification", () => {
  assert.match(page, /<body class="auth-pending">/);
  assert.match(page, /id="authBoot"[\s\S]*?Memeriksa sesi AutoDoc/);
  assert.match(page, /id="authPage" class="auth-page" hidden/);
  assert.match(theme, /body\.auth-pending #authPage,[\s\S]*?display:none!important/);
  const initialize = page.slice(page.indexOf("async function initialize()"), page.indexOf("initialize();"));
  assert.ok(initialize.indexOf('requestJson("auth/session")') < initialize.indexOf("showLogin();"));
  assert.doesNotMatch(initialize, /authPage\.hidden\s*=\s*false/);
  assert.match(page, /function finishAuthBootstrap\(\)[\s\S]*?classList\.remove\("auth-pending"\)/);
  assert.match(page, /function showHome\(\)\s*\{\s*finishAuthBootstrap\(\)/);
  assert.match(page, /function showLogin\(\)\s*\{\s*finishAuthBootstrap\(\)/);
});
