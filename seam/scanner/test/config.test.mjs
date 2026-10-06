import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadEnv, loadWatchlist, parseWatchlist } from '../src/config.mjs';
import { loadScript } from '../src/engine.mjs';

const known = loadScript().inputs;
const TOKEN = '123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

test('the committed watchlist.json is valid against the indicator inputs', () => {
  const w = loadWatchlist(known);
  assert.deepEqual(w.series.map((s) => s.id), ['BINANCE:BTCUSDT|60', 'BINANCE:ETHUSDT|60']);
  assert.deepEqual(w.inputs, { 민감도: 'normal', '표시 개수': 1 });
});

test('watchlist: other exchanges, unknown TFs, duplicates and misspelled inputs are refused', () => {
  const bad = (w, re) => assert.throws(() => parseWatchlist(w, known), re);
  bad({ series: [{ symbol: 'UPBIT:KRW-BTC', tf: '60' }] }, /only BINANCE/);
  bad({ series: [{ symbol: 'BINANCE:BTCUSDT', tf: '7' }] }, /tf 7/);
  bad({ series: [{ symbol: 'BINANCE:BTCUSDT', tf: '60' }, { symbol: 'BTCUSDT', tf: '60' }] }, /listed twice/);
  bad({ series: [{ symbol: 'BINANCE:BTCUSDT', tf: '60' }], inputs: { 민감: 'normal' } }, /unknown indicator input "민감"/);
  bad({ series: [] }, /no series/);
});

test('env: token and chat id are required unless dry-run; events are checked', () => {
  assert.throws(() => loadEnv({}), /TELEGRAM_BOT_TOKEN.*\n.*TELEGRAM_CHAT_ID/s);
  assert.throws(() => loadEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: 'me' }), /TELEGRAM_CHAT_ID/);
  assert.throws(() => loadEnv({ SEAM_DRY_RUN: 'true', SEAM_EVENTS: 'lock,boom' }), /unknown events: boom/);
  const e = loadEnv({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: '987654321' });
  assert.equal(e.dryRun, false);
  assert.deepEqual([...e.events], ['lock', 'break_up', 'break_down', 'fail']);
  assert.equal(loadEnv({ SEAM_DRY_RUN: 'yes' }).chatId, 'dry-run');
});
