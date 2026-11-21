import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("login page uses a centered single-column layout and BGN logo", () => {
  assert.match(page, /<main id="authPage" class="auth-page">/);
  assert.match(page, /class="auth-logo"[\s\S]*?width="72"[\s\S]*?height="72"/);
  assert.match(page, /object\/public\/logo%20bgn\/logo-bgn%20\(1\)\.png/);
  assert.doesNotMatch(page, /class="brand-panel"|class="visual-card"|class="brand-benefits"|class="welcome-tag"/);
  assert.match(page, /background:\s*#F6F7F5/);
  assert.match(page, /border:\s*1px solid #E1E6E2/);
  assert.match(page, /border-radius:\s*16px/);
  assert.match(page, /padding:\s*32px/);
  assert.match(page, /width:\s*min\(100%, 400px\)/);
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
