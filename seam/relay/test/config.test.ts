import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describe, loadConfig, secretsOf } from '../src/config.ts';
import { BOT, TOKEN, testConfig } from './fixtures.ts';

test('defaults', () => {
  const c = testConfig();
  assert.equal(c.port, 8787);
  assert.deepEqual([...c.events], ['lock', 'break_up', 'break_down', 'fail']);
  assert.equal(c.allowPreview, false);
  assert.equal(c.allowReference, false);
  assert.equal(c.ratePerMin, 3);
  assert.equal(c.route.confirmedTopic, undefined);
});

test('requires auth, bot token and chat id (lists every problem)', () => {
  assert.throws(() => loadConfig({}), (e: Error) => /SEAM_WEBHOOK_TOKEN/.test(e.message) && /TELEGRAM_BOT_TOKEN/.test(e.message) && /TELEGRAM_CHAT_ID/.test(e.message));
});

test('rejects weak or malformed secrets and bad values', () => {
  const base = { SEAM_WEBHOOK_TOKEN: TOKEN, TELEGRAM_BOT_TOKEN: BOT, TELEGRAM_CHAT_ID: '-100123' };
  assert.throws(() => loadConfig({ ...base, SEAM_WEBHOOK_TOKEN: 'short' }));
  assert.throws(() => loadConfig({ ...base, SEAM_HMAC_SECRET: 'short' }));
  assert.throws(() => loadConfig({ ...base, TELEGRAM_BOT_TOKEN: 'nope' }));
  assert.throws(() => loadConfig({ ...base, SEAM_EVENTS: 'lock,buy' }));
  assert.throws(() => loadConfig({ ...base, TELEGRAM_TOPIC_KR: 'abc' }));
  assert.throws(() => loadConfig({ ...base, SEAM_ALLOW_PREVIEW: 'maybe' }));
  assert.throws(() => loadConfig({ ...base, PORT: '99999' }));
});

test('dry run does not need a bot token', () => {
  const c = loadConfig({ SEAM_WEBHOOK_TOKEN: TOKEN, TELEGRAM_CHAT_ID: '@my_channel', SEAM_DRY_RUN: 'true' });
  assert.equal(c.dryRun, true);
});

test('topics, allowlist, prefixes', () => {
  const c = testConfig({
    TELEGRAM_TOPIC_KR: '11',
    TELEGRAM_TOPIC_CONFIRMED: '99',
    SEAM_TICKER_ALLOWLIST: 'nasdaq:aapl, KRX:005930',
    SEAM_MARKET_PREFIXES: 'US=ARCA2',
  });
  assert.equal(c.route.topics.KR, 11);
  assert.equal(c.route.confirmedTopic, 99);
  assert.ok(c.tickerAllowlist?.has('NASDAQ:AAPL'));
  assert.ok(c.route.prefixes.US.includes('ARCA2'));
});

test('describe() never contains secrets', () => {
  const c = testConfig({ SEAM_HMAC_SECRET: 'h'.repeat(40) });
  const text = JSON.stringify(describe(c));
  for (const s of secretsOf(c)) assert.ok(!text.includes(s));
});
