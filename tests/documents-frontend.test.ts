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

test("printed status is updated only after the print dialog has been invoked", () => {
  assert.match(source, /const logo=win\.document\.querySelector\("\.top-logo"\)/);
  assert.match(source, /logo\.addEventListener\("load",invokePrint/);
  assert.match(source, /logo\.addEventListener\("error",invokePrint/);
  assert.match(source, /try\{win\.focus\(\);win\.print\(\)\}catch\(_\)\{return\}[\s\S]*?api\("docs\/mark-printed"/);
});
