import assert from "node:assert/strict";
import test from "node:test";
import {
  joinMenuComponents,
  normalizeDocumentKinds,
  normalizeMealTime,
  normalizeMenuComponents,
  settingsForDistributionSnapshot,
  WorkflowValidationError,
} from "../supabase/functions/autodoc-auth/distribution-workflow.ts";

test("menu components are joined in their entered order", () => {
  const items = normalizeMenuComponents(["Nasi Putih", "Tempe Orek", "Tumis Sayur"]);
  assert.equal(joinMenuComponents(items), "Nasi Putih, Tempe Orek, Tumis Sayur");
});

test("legacy menu is preserved as one component without splitting commas", () => {
  const items = normalizeMenuComponents(undefined, "Nasi, lauk, dan sayur");
  assert.deepEqual(items, ["Nasi, lauk, dan sayur"]);
  assert.equal(joinMenuComponents(items), "Nasi, lauk, dan sayur");
});

test("menu is optional but limited to eight non-empty components", () => {
  assert.deepEqual(normalizeMenuComponents([]), []);
  assert.equal(normalizeMenuComponents(["1", "2", "3", "4", "5", "6", "7", "8"]).length, 8);
  assert.throws(() => normalizeMenuComponents(["1", "2", "3", "4", "5", "6", "7", "8", "9"]), WorkflowValidationError);
  assert.throws(() => normalizeMenuComponents(["Nasi", "   "]), WorkflowValidationError);
});

test("document types default to both and allow either single type", () => {
  assert.deepEqual(normalizeDocumentKinds(undefined), ["SJ", "BAST"]);
  assert.deepEqual(normalizeDocumentKinds(["SJ"]), ["SJ"]);
  assert.deepEqual(normalizeDocumentKinds(["BAST"]), ["BAST"]);
  assert.throws(() => normalizeDocumentKinds([]), WorkflowValidationError);
  assert.throws(() => normalizeDocumentKinds(["ORGAN"]), WorkflowValidationError);
});

test("meal time defaults to siang and accepts only pagi, siang, sore", () => {
  assert.equal(normalizeMealTime(undefined), "siang");
  assert.equal(normalizeMealTime("pagi"), "pagi");
  assert.equal(normalizeMealTime("sore"), "sore");
  assert.throws(() => normalizeMealTime("malam"), WorkflowValidationError);
});

test("the distribution snapshot keeps the ahli gizi name frozen at issuance", () => {
  const snapshot = settingsForDistributionSnapshot(
    { nama_sppg: "SPPG", nama_ahli_gizi: "Nama master terbaru" },
    { nama_ahli_gizi: "Nama saat penerbitan" },
  );
  assert.equal(snapshot.nama_ahli_gizi, "Nama saat penerbitan");
});
