import assert from 'node:assert/strict';
import { test } from 'node:test';
import { destinationsFor, marketOf, mergePrefixes, type RouteConfig } from '../src/route.ts';
import { validateAlert, type SeamAlert } from '../src/schema.ts';
import { sample } from './fixtures.ts';

const prefixes = mergePrefixes(undefined);

function alert(over: Record<string, unknown>): SeamAlert {
  const r = validateAlert(sample(over));
  assert.ok(r.ok);
  return r.alert;
}

test('market by exchange prefix', () => {
  assert.equal(marketOf('KRX:005930', prefixes), 'KR');
  assert.equal(marketOf('NASDAQ:AAPL', prefixes), 'US');
  assert.equal(marketOf('BINANCE:BTCUSDT', prefixes), 'CRYPTO');
  assert.equal(marketOf('UPBIT:KRW-BTC', prefixes), 'CRYPTO');
  assert.equal(marketOf('OANDA:XAUUSD', prefixes), 'OTHER');
});

test('extra prefixes are additive and validated', () => {
  const p = mergePrefixes('US=ARCA2, bad-prefix ;CRYPTO=LBANK;XX=FOO');
  assert.ok(p.US.includes('ARCA2'));
  assert.ok(p.US.includes('NASDAQ'));
  assert.ok(!p.US.includes('BAD-PREFIX'));
  assert.ok(p.CRYPTO.includes('LBANK'));
});

test('routes to market topic and mirrors confirmed breaks', () => {
  const cfg: RouteConfig = { chatId: '-100', topics: { KR: 11, US: 12, CRYPTO: 13 }, confirmedTopic: 99, prefixes };
  const brk = destinationsFor(alert({ ticker: 'KRX:005930', event: 'break_down', phase: 'break_down' }), cfg);
  assert.deepEqual(brk.map((d) => d.threadId), [11, 99]);
  const lock = destinationsFor(alert({ ticker: 'NASDAQ:AAPL', event: 'lock', phase: 'locked' }), cfg);
  assert.deepEqual(lock.map((d) => d.threadId), [12]);
});

test('no topics → chat root (DM works)', () => {
  const cfg: RouteConfig = { chatId: '12345', topics: {}, prefixes };
  const d = destinationsFor(alert({}), cfg);
  assert.equal(d.length, 1);
  assert.equal(d[0]?.threadId, undefined);
});
