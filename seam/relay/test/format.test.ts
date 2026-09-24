import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMessage, EVENT_TEXT, formatPrice, formatTf, KEY_NAMES } from '../src/format.ts';
import { EVENTS, KEYS, validateAlert, type SeamAlert } from '../src/schema.ts';
import { sample } from './fixtures.ts';

function alert(over: Record<string, unknown> = {}): SeamAlert {
  const r = validateAlert(sample(over));
  assert.ok(r.ok);
  return r.alert;
}

test('matches the spec §8.2 template for a horizontal structure', () => {
  const text = buildMessage(alert({ upper_now: 221.4, lower_now: 214.1 }));
  assert.equal(
    text,
    ['SEAM · AAPL 1H', '대칭삼각 상단 돌파 (종가 확정)', '잠금가 상 221.40 / 하 214.10', '밀착 0.74 · 접점 3/3 · formal · 종가 222.00', '정보일 뿐 주문 아님'].join('\n'),
  );
});

test('sloped structures show the extended locked line at the event bar', () => {
  const text = buildMessage(alert());
  assert.match(text, /현재선 상 220\.90 \/ 하 215\.30/);
  assert.doesNotMatch(buildMessage(alert({ event: 'lock', phase: 'locked' })), /현재선/);
});

test('every key and event has Korean text', () => {
  for (const k of KEYS) assert.ok(KEY_NAMES[k]);
  for (const e of EVENTS) assert.ok(EVENT_TEXT[e]);
});

test('PRINCIPLE 8: no order wording in any message', () => {
  const banned = /매수|매도|사세요|파세요|진입하|청산하|buy|sell|long now|short now/i;
  for (const k of KEYS) {
    for (const e of EVENTS) {
      const text = buildMessage(alert({ key: k, event: e }));
      assert.doesNotMatch(text, banned, `${k}/${e}`);
      assert.match(text, /정보일 뿐 주문 아님$/);
    }
  }
});

test('preview is labelled', () => {
  assert.match(buildMessage(alert({ preview: true })), /미리보기\(봉 미확정\)/);
});

test('timeframes', () => {
  assert.equal(formatTf('60'), '1H');
  assert.equal(formatTf('240'), '4H');
  assert.equal(formatTf('15'), '15m');
  assert.equal(formatTf('D'), '1D');
  assert.equal(formatTf('1D'), '1D');
  assert.equal(formatTf('1W'), '1W');
  assert.equal(formatTf('M'), '1M');
  assert.equal(formatTf('30S'), '30s');
});

test('prices', () => {
  assert.equal(formatPrice(221.4), '221.40');
  assert.equal(formatPrice(71500), '71500');
  assert.equal(formatPrice(0.00001234), '0.00001234');
  assert.equal(formatPrice(0.5123456), '0.5123');
});

test('prices in one message share a format', () => {
  const krw = buildMessage(alert({ ticker: 'KRX:005930', upper: 71500, lower: 68000, upper_now: 71500, lower_now: 68000, close: 72000 }));
  assert.match(krw, /잠금가 상 71500 \/ 하 68000/);
  assert.match(krw, /종가 72000/);
});
