import assert from 'node:assert/strict';
import { test } from 'node:test';
import { idempotencyKey, parseAlert, structureId, validateAlert } from '../src/schema.ts';
import { sample } from './fixtures.ts';

test('accepts the payload the Pine script emits', () => {
  const r = parseAlert(JSON.stringify(sample()));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.alert.key, 'TRI_SYM');
  assert.deepEqual(r.alert.touches, [3, 3]);
  assert.equal(r.alert.preview, false);
});

test('accepts the minimal spec §8.1 payload (optional fields absent)', () => {
  const { bar_ts, upper_now, lower_now, touches, bias, preview, ...min } = sample();
  const r = validateAlert(min);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.alert.preview, false);
});

test('rejects non-JSON and non-object bodies', () => {
  assert.equal(parseAlert('not json').ok, false);
  assert.equal(parseAlert('[1,2]').ok, false);
  assert.equal(parseAlert('null').ok, false);
});

test('rejects wrong version, source, enums', () => {
  for (const bad of [{ v: 2 }, { src: 'other' }, { event: 'forming' }, { key: 'HEAD_SHOULDERS' }, { grade: 'gold' }, { phase: 'done' }, { bias: 'sideways' }]) {
    const r = validateAlert(sample(bad));
    assert.equal(r.ok, false, JSON.stringify(bad));
  }
});

test('rejects bad numbers and timestamps', () => {
  for (const bad of [
    { upper: 'x' },
    { close: null },
    { adhesion: 1.2 },
    { adhesion: -0.1 },
    { lock_ts: 1750000000000 }, // milliseconds, not seconds
    { lock_ts: 1.5 },
    { bar_ts: 1740000000 }, // before lock
    { upper: 200, lower: 210 },
    { touches: [3] },
    { touches: [3, -1] },
  ]) {
    assert.equal(validateAlert(sample(bad)).ok, false, JSON.stringify(bad));
  }
});

test('ticker and tf formats', () => {
  for (const ticker of ['NASDAQ:AAPL', 'KRX:005930', 'BINANCE:BTCUSDT.P', 'CME_MINI:ES1!', 'NYSE:BRK.B', 'AAPL']) {
    assert.equal(validateAlert(sample({ ticker })).ok, true, ticker);
  }
  for (const ticker of ['NASDAQ:', ':AAPL', 'A:B"C', 'A:B:C', 'X:'.padEnd(80, 'A')]) {
    assert.equal(validateAlert(sample({ ticker })).ok, false, ticker);
  }
  for (const tf of ['1', '60', '240', 'D', '1D', '1W', 'M', '30S']) assert.equal(validateAlert(sample({ tf })).ok, true, tf);
  for (const tf of ['', '1h', '60m', '12345D']) assert.equal(validateAlert(sample({ tf })).ok, false, tf);
});

test('reason must be a short code or null', () => {
  assert.equal(validateAlert(sample({ reason: 'too_few_touches' })).ok, true);
  assert.equal(validateAlert(sample({ reason: 'Buy now!' })).ok, false);
});

test('caps key count', () => {
  const big: Record<string, unknown> = sample();
  for (let i = 0; i < 40; i++) big[`x${i}`] = i;
  assert.equal(validateAlert(big).ok, false);
});

test('structure id and idempotency key follow the spec', () => {
  const r = validateAlert(sample({ ticker: 'nasdaq:aapl' }));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(structureId(r.alert), 'NASDAQ:AAPL|60|TRI_SYM|1750000000');
  assert.equal(idempotencyKey(r.alert), 'NASDAQ:AAPL|60|TRI_SYM|1750000000|break_up');
});
