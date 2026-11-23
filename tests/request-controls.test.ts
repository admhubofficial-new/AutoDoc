import test from "node:test";
import assert from "node:assert/strict";
import { AiRequestGate } from "../supabase/functions/autodoc-auth/request-controls.ts";

test("AI gate applies per-session request quotas without sharing one user's quota with another", () => {
  const gate = new AiRequestGate(4, 2, 1000, 10);
  const first = gate.acquire("session-a", 10_000);
  const second = gate.acquire("session-a", 10_100);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  first.release();
  second.release();

  const blocked = gate.acquire("session-a", 10_200);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "session_quota");
  assert.equal(blocked.retryAfterSeconds, 1);

  const otherSession = gate.acquire("session-b", 10_200);
  assert.equal(otherSession.allowed, true);
  otherSession.release();
});

test("AI gate bounds concurrent work and releases capacity idempotently", () => {
  const gate = new AiRequestGate(1, 5, 60_000, 10);
  const first = gate.acquire("session-a", 1000);
  assert.equal(first.allowed, true);
  assert.equal(gate.activeRequests, 1);

  const blocked = gate.acquire("session-b", 1000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "concurrency");
  assert.equal(blocked.retryAfterSeconds, 5);

  first.release();
  first.release();
  assert.equal(gate.activeRequests, 0);
  const next = gate.acquire("session-b", 1000);
  assert.equal(next.allowed, true);
  next.release();
});

test("AI gate expires windows and reclaims inactive session slots", () => {
  const gate = new AiRequestGate(2, 1, 1000, 1);
  const first = gate.acquire("session-a", 1000);
  assert.equal(first.allowed, true);
  first.release();

  const capacityBlocked = gate.acquire("session-b", 1500);
  assert.equal(capacityBlocked.allowed, false);
  assert.equal(capacityBlocked.reason, "capacity");

  const afterExpiry = gate.acquire("session-b", 2001);
  assert.equal(afterExpiry.allowed, true);
  afterExpiry.release();
});

test("AI gate rejects missing session keys and invalid configuration", () => {
  assert.throws(() => new AiRequestGate(0, 1, 1000, 1), RangeError);
  const gate = new AiRequestGate();
  assert.throws(() => gate.acquire(""), TypeError);
});
