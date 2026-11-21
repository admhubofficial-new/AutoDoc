import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../documents.js", import.meta.url), "utf8");

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
  assert.match(source, /class='top-logo' src='/);
});

test("printed status waits for all letterhead assets and follows the print dialog", () => {
  assert.match(source, /const logos=Array\.from\(win\.document\.querySelectorAll\("\.top-logo"\)\)/);
  assert.match(source, /logo\.addEventListener\("load",resolve/);
  assert.match(source, /logo\.addEventListener\("error",resolve/);
  assert.match(source, /Promise\.all\(logos\.map\(imageReady\)\)/);
  assert.match(source, /try\{win\.focus\(\);win\.print\(\)\}catch\(_\)\{return\}[\s\S]*?api\("docs\/mark-printed"/);
});


test("creation trusts the session-protected endpoint that already filters active recipients", () => {
  assert.match(source, /api\("master\\/recipients"\)/);
  assert.match(source, /const recipients=Array\\.isArray\\(master\\.recipients\\)\\?master\\.recipients:\\[\\]/);
  assert.doesNotMatch(source, /master\\.recipients\\)\\.filter\\(isActiveRecipient/);
});
