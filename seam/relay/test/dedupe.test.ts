import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SlidingWindowLimiter, TtlSet } from '../src/dedupe.ts';

test('TtlSet claims once until expiry', () => {
  const s = new TtlSet(1000);
  assert.equal(s.claim('a', 0), true);
  assert.equal(s.claim('a', 500), false);
  assert.equal(s.has('a', 999), true);
  assert.equal(s.claim('a', 1000), true);
});

test('TtlSet evicts oldest beyond capacity', () => {
  const s = new TtlSet(10_000, 3);
  for (const k of ['a', 'b', 'c', 'd']) s.claim(k, 0);
  assert.equal(s.size, 3);
  assert.equal(s.has('a', 1), false);
  assert.equal(s.has('d', 1), true);
});

test('limiter allows N per window per key', () => {
  const l = new SlidingWindowLimiter(3, 60_000);
  assert.equal(l.allow('X', 0), true);
  assert.equal(l.allow('X', 1), true);
  assert.equal(l.allow('X', 2), true);
  assert.equal(l.allow('X', 3), false);
  assert.equal(l.allow('Y', 3), true);
  assert.equal(l.allow('X', 60_001), true);
});
