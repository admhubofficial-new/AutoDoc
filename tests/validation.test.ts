import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidClockTime,
  isValidIsoDate,
  normalizeUuidList,
  parseNonNegativeInteger,\n  parseContentRangeTotal,
} from "../supabase/functions/autodoc-auth/validation.ts";

test("date validation accepts real ISO calendar dates and rejects impossible dates", () => {
  assert.equal(isValidIsoDate("2024-02-29"), true);
  assert.equal(isValidIsoDate("2026-11-21"), true);
  assert.equal(isValidIsoDate("2025-02-29"), false);
  assert.equal(isValidIsoDate("2026-13-01"), false);
  assert.equal(isValidIsoDate("21-11-2026"), false);
  assert.equal(isValidIsoDate(null), false);
});

test("time validation accepts HH:MM and HH:MM:SS only", () => {
  assert.equal(isValidClockTime("00:00"), true);
  assert.equal(isValidClockTime("23:59"), true);
  assert.equal(isValidClockTime("12:30:59"), true);
  assert.equal(isValidClockTime("24:00"), false);
  assert.equal(isValidClockTime("12:60"), false);
  assert.equal(isValidClockTime("9:30"), false);
});

test("non-negative integer parsing uses fallbacks and rejects unsafe values", () => {
  assert.equal(parseNonNegativeInteger("", 100), 100);
  assert.equal(parseNonNegativeInteger(null, 0), 0);
  assert.equal(parseNonNegativeInteger(" 12 ", 0), 12);
  assert.equal(parseNonNegativeInteger(0), 0);
  assert.equal(parseNonNegativeInteger(-1), null);
  assert.equal(parseNonNegativeInteger(1.5), null);
  assert.equal(parseNonNegativeInteger(true), null);
  assert.equal(parseNonNegativeInteger("abc"), null);
  assert.equal(parseNonNegativeInteger(Number.MAX_SAFE_INTEGER + 1), null);
});

test("UUID recipient lists validate shape, enforce a maximum, and de-duplicate IDs", () => {
  const a = "550e8400-e29b-41d4-a716-446655440000";
  const b = "550e8400-e29b-41d4-a716-446655440001";
  assert.deepEqual(normalizeUuidList([a, b, a]), [a, b]);
  assert.equal(normalizeUuidList([]), null);
  assert.equal(normalizeUuidList(["not-a-uuid"]), null);
  assert.equal(normalizeUuidList([a, 1]), null);
  assert.equal(normalizeUuidList(Array(101).fill(a)), null);
});


test("PostgREST exact content range totals are parsed safely", () => {
  assert.equal(parseContentRangeTotal("0-0/17"), 17);
  assert.equal(parseContentRangeTotal("*/0"), 0);
  assert.equal(parseContentRangeTotal("0-0/0"), 0);
  assert.equal(parseContentRangeTotal(null), null);
  assert.equal(parseContentRangeTotal("items 0-0/17"), null);
  assert.equal(parseContentRangeTotal("0-0/*"), null);
  assert.equal(parseContentRangeTotal("0-0/-1"), null);
});
