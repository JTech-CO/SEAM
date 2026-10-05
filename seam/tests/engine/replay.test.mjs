// replay.mjs: offline run on saved candles + comparison with a transcribed TradingView log.
// Network is not used here; fetchCandles is exercised by hand (see seam/tests/real/README.md).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeBars } from './harness.mjs';
import { scenarios } from './scenarios.mjs';
import { compare, formatTime, runReplay } from './replay.mjs';

const T0 = Date.UTC(2026, 8, 28, 0, 0);
const candles = {
  v: 1, source: 'synthetic', symbol: 'BINANCE:TESTUSDT', tf: '1', mintick: 0.01,
  bars: makeBars(scenarios.TRI_SYM, { seed: 7, t0: T0, stepMs: 60e3 }).map((b) => [b.time, b.open, b.high, b.low, b.close, b.volume]),
};
const toExpected = (events) => ({
  tz: 'Asia/Seoul',
  events: events.map((e) => ({ code: e.code, at: new Date(e.barMs).toISOString(), key: e.key, px: e.px })),
});

test('replay: saved candles → the same formal events the log would show', async () => {
  const events = await runReplay(candles);
  const keys = events.filter((e) => e.key === 'TRI_SYM').map((e) => e.code);
  assert.ok(keys.includes('LOCK'), `TRI_SYM lock in ${JSON.stringify(keys)}`);
  assert.ok(keys.includes('UP'), `TRI_SYM break up in ${JSON.stringify(keys)}`);
  assert.ok(events.every((e) => e.grade === 'formal'));
  assert.equal(formatTime(T0, 'Asia/Seoul', '1'), '09-28 09:00');
  assert.equal(formatTime(T0, 'UTC', 'D'), '26-09-28');
});

test('replay: comparison flags price, missing and extra events', async () => {
  const events = await runReplay(candles);
  assert.ok(compare(events, toExpected(events), candles.mintick).ok);

  const priced = toExpected(events);
  priced.events[0].px = priced.events[0].px.map((v) => v + 0.02);
  assert.equal(compare(events, priced, candles.mintick).rows[0].status, 'price');

  const shifted = toExpected(events);
  shifted.events[0].at = new Date(events[0].barMs + 60e3).toISOString();
  assert.equal(compare(events, shifted, candles.mintick).rows[0].status, 'missing');

  // the log is complete up to `until`, so an engine event it lacks inside that span is extra
  const dropped = { ...toExpected(events), until: new Date(events.at(-1).barMs).toISOString() };
  dropped.events.splice(1, 1);
  const r = compare(events, dropped, candles.mintick);
  assert.equal(r.extra.length, 1);
  assert.equal(r.ok, false);

  // the log shows its last rows only: an event emitted before the oldest row on the same bar was cut off,
  // one emitted after it on that bar is extra
  const ev = (code, key, barMs) => ({ code, key, barMs, px: [1] });
  const bar = [ev('FAIL', 'A', 3600e3), ev('RETEST', 'B', 3600e3), ev('UP', 'C', 7200e3)];
  const log = (...xs) => ({ until: new Date(7200e3).toISOString(), events: xs.map((e) => ({ ...e, at: new Date(e.barMs).toISOString() })) });
  assert.ok(compare(bar, log(bar[1], bar[2]), 0.01).ok);
  assert.deepEqual(compare(bar, log(bar[0], bar[2]), 0.01).extra.map((e) => e.key), ['B']);
});

// Real-chart parity: every seam/tests/real/<name>.tv.json with a committed <name>.klines.json must match.
const REAL = fileURLToPath(new URL('../real/', import.meta.url));
for (const f of fs.readdirSync(REAL).filter((x) => x.endsWith('.tv.json'))) {
  const kl = path.join(REAL, f.replace(/\.tv\.json$/, '.klines.json'));
  const have = fs.existsSync(kl);
  test(`parity with TradingView log: ${f}`, { skip: have ? false : 'klines not committed yet (seam/tests/real/README.md)' }, async () => {
    const expected = JSON.parse(fs.readFileSync(path.join(REAL, f), 'utf8'));
    const real = JSON.parse(fs.readFileSync(kl, 'utf8'));
    const r = compare(await runReplay(real, expected.inputs), expected, real.mintick);
    assert.ok(r.ok, JSON.stringify({ mismatched: r.rows.filter((x) => x.status !== 'match'), extra: r.extra }, null, 1));
  });

  // Start-point shift (seam/docs/SCANNER.md 3.5): dropping older history must not change what the log shows,
  // as long as some warm-up remains before the first logged event.
  test(`parity survives a later start: ${f}`, { skip: have ? false : 'klines not committed yet' }, async () => {
    const expected = JSON.parse(fs.readFileSync(path.join(REAL, f), 'utf8'));
    const real = JSON.parse(fs.readFileSync(kl, 'utf8'));
    const first = Math.min(...expected.events.map((e) => Date.parse(e.at)));
    const iFirst = real.bars.findIndex((b) => b[0] >= first);
    for (const warm of [300, 1000, 2000]) {
      if (iFirst - warm <= 0) continue;
      const cut = { ...real, bars: real.bars.slice(iFirst - warm) };
      const r = compare(await runReplay(cut, expected.inputs), expected, real.mintick);
      assert.ok(r.ok, `warm-up ${warm}: ${JSON.stringify({ mismatched: r.rows.filter((x) => x.status !== 'match'), extra: r.extra })}`);
    }
  });
}

test('replay CLI: --klines + --expect exits 0 on a match, 1 on a mismatch', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seam-replay-'));
  const kl = path.join(dir, 'k.json');
  const ex = path.join(dir, 'e.json');
  fs.writeFileSync(kl, JSON.stringify(candles));
  const expected = toExpected(await runReplay(candles));
  fs.writeFileSync(ex, JSON.stringify(expected));
  const cli = fileURLToPath(new URL('./replay.mjs', import.meta.url));
  const ok = spawnSync(process.execPath, [cli, '--klines', kl, '--expect', ex], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr + ok.stdout);
  assert.match(ok.stdout, /TradingView 로그와 일치/);

  expected.events[0].px[0] += 1;
  fs.writeFileSync(ex, JSON.stringify(expected));
  const bad = spawnSync(process.execPath, [cli, '--klines', kl, '--expect', ex], { encoding: 'utf8' });
  assert.equal(bad.status, 1, bad.stderr + bad.stdout);
  assert.match(bad.stdout, /PRICE/);
  fs.rmSync(dir, { recursive: true, force: true });
});
