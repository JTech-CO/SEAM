// Scanner loop on recorded Binance bars with a fake clock (seam/docs/SCANNER.md 4.4). Sending is replaced by a
// recorder, so these tests need no network and no Telegram.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { buildMessage } from '../../relay/src/format.ts';
import { loadScript, runWindow } from '../src/engine.mjs';
import { CLOSE_DELAY_MS, nextRunAt, RETRY_MS, roundToTick, Scanner } from '../src/scanner.mjs';

const candles = JSON.parse(fs.readFileSync(new URL('../../tests/real/btcusdt-1h-2026-10-02.klines.json', import.meta.url), 'utf8'));
const STEP = 3600e3;
const bars = candles.bars;
const script = loadScript();
const watchlist = { series: [{ id: 'BINANCE:BTCUSDT|60', symbol: 'BINANCE:BTCUSDT', tf: '60' }], inputs: { 민감도: 'normal', '표시 개수': 1 } };
const ID = watchlist.series[0].id;
const EVENTS = new Set(['lock', 'break_up', 'break_down', 'fail']);
const WARM = 300;
const K = bars.length - 161; // first bar fed after the warm-up
const closeOf = (i) => bars[i][0] + STEP;
const quiet = { info() {}, warn() {}, error() {} };

// Exchange stand-in: serves a bar once it has closed (and, with lagMs, only that long after the close).
function market({ lagMs = 0, mintick = candles.mintick } = {}) {
  return {
    tickSize: async () => mintick,
    closedBars: async ({ startMs, endMs, now }) => bars.filter((b) => b[0] >= startMs && b[0] <= endMs && b[0] + STEP + lagMs <= now),
  };
}

function scanner(opts = {}) {
  const sent = [];
  const clock = { t: opts.t ?? closeOf(K - 1) + CLOSE_DELAY_MS };
  const s = new Scanner({
    script, watchlist, events: EVENTS, chatId: '1', logger: quiet, statePath: opts.statePath ?? null,
    market: market(opts), now: () => clock.t, warmupBars: WARM, maxBars: 100000,
    sender: async (dest, text) => (sent.push({ text, t: clock.t, dest }), { ok: true, status: 200 }),
  });
  return { s, sent, clock };
}

// What the scanner should send: one run over the final window, events after the warm-up, as the relay formats them.
async function expected(fromIndex = K) {
  const window = { ...candles, bars: bars.slice(K - WARM) };
  const out = [];
  for (const raw of await runWindow(script, window, watchlist.inputs)) {
    const a = JSON.parse(raw);
    if (a.bar_ts * 1000 < bars[fromIndex][0] || a.grade !== 'formal' || !EVENTS.has(a.event)) continue;
    out.push({ text: buildMessage(roundToTick(a, candles.mintick)), t: a.bar_ts * 1000 + STEP + CLOSE_DELAY_MS, barMs: a.bar_ts * 1000 });
  }
  return out;
}

async function feed({ s, clock }, from, to) {
  for (let i = from; i < to; i++) {
    clock.t = closeOf(i) + CLOSE_DELAY_MS;
    await s.poll(ID);
  }
}

const tmpState = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'seam-scanner-')), 'state.json');

test('each event is sent once, on the first run after its bar closes; the warm-up sends nothing', async () => {
  const want = await expected();
  assert.ok(want.length >= 3, `fixture should have events after the warm-up, got ${want.length}`);
  const run = scanner();
  await run.s.start();
  assert.deepEqual(run.sent, [], 'warm-up bars are history, not alerts');
  await feed(run, K, bars.length);
  assert.deepEqual(run.sent.map(({ text, t }) => ({ text, t })), want.map(({ text, t }) => ({ text, t })));
  for (const m of run.sent) assert.equal(m.text.split('\n').at(-1), '정보일 뿐 주문 아님');
});

test('a fresh start right after an event bar sends nothing (that bar is part of the warm-up)', async () => {
  const want = await expected();
  const iE = bars.findIndex((b) => b[0] === want[0].barMs);
  const run = scanner({ t: closeOf(iE) + CLOSE_DELAY_MS });
  await run.s.start();
  assert.deepEqual(run.sent, []);
  await feed(run, iE + 1, iE + 3);
  assert.ok(!run.sent.some((m) => m.text === want[0].text));
});

test('a bar is not used before it closes', async () => {
  const run = scanner();
  await run.s.start();
  run.clock.t = closeOf(K) - 1; // one ms before the close
  assert.deepEqual(await run.s.poll(ID), { newBars: 0, sent: 0 });
  run.clock.t = closeOf(K) + CLOSE_DELAY_MS;
  assert.equal((await run.s.poll(ID)).newBars, 1);
});

test('restart: a new process with the same state file sends nothing twice and misses nothing', async () => {
  const want = await expected();
  const statePath = tmpState();
  const mid = K + Math.floor((bars.length - K) / 2);
  const a = scanner({ statePath });
  await a.s.start();
  assert.equal(JSON.parse(fs.readFileSync(statePath, 'utf8')).series[ID].lastBar, bars[K - 1][0], 'state written right after the warm-up');
  await feed(a, K, mid);
  // stop and start again at the same moment: the warm-up fetch sees no new bar, so nothing is sent
  const b = scanner({ statePath, t: a.clock.t });
  await b.s.start();
  assert.deepEqual(b.sent, []);
  await feed(b, mid, bars.length);
  const all = [...a.sent, ...b.sent].map((m) => m.text);
  assert.equal(new Set(all).size, all.length, 'no duplicates');
  assert.deepEqual(all, want.map((m) => m.text));
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.series[ID].lastBar, bars.at(-1)[0]);
});

test('after an outage only the last 3 missed bars are caught up', async () => {
  const want = await expected();
  // newest bar at start = two bars after an event bar; the state says ten bars were missed
  const e = want[Math.floor(want.length / 2)];
  const iE = bars.findIndex((b) => b[0] === e.barMs);
  const statePath = tmpState();
  fs.writeFileSync(statePath, JSON.stringify({ series: { [ID]: { lastBar: bars[iE - 8][0] } }, sent: {} }));
  const run = scanner({ statePath, t: closeOf(iE + 2) + CLOSE_DELAY_MS });
  await run.s.start();
  const lo = bars[iE - 1][0];
  const hi = bars[iE + 2][0];
  const inWindow = (await expected(K)).filter((m) => m.barMs > lo && m.barMs <= hi).map((m) => m.text);
  assert.ok(inWindow.includes(e.text));
  assert.deepEqual(run.sent.map((m) => m.text), inWindow);
});

test('run(): polls 3 s after each close and retries while the exchange has not served the bar', async () => {
  const run = scanner({ lagMs: 10_000, t: closeOf(K - 1) + 20_000 }); // warm-up already has bar K-1
  await run.s.start();
  const polls = [];
  const poll = run.s.poll.bind(run.s);
  run.s.poll = async (id) => {
    polls.push(run.clock.t);
    return poll(id);
  };
  await run.s.run({ sleep: async (ms) => { run.clock.t += ms; }, stop: () => polls.length >= 6 });
  const c0 = closeOf(K - 1) + STEP; // close of bar K
  // +3 s (not served), +8 s (not served), +13 s (served); then the next close
  assert.deepEqual(polls.slice(0, 4), [c0 + CLOSE_DELAY_MS, c0 + CLOSE_DELAY_MS + RETRY_MS, c0 + CLOSE_DELAY_MS + 2 * RETRY_MS, c0 + STEP + CLOSE_DELAY_MS]);
  assert.equal(nextRunAt(c0 + 1, STEP), c0 + STEP + CLOSE_DELAY_MS);
  // weekly bars open on Monday 00:00 UTC
  const week = 7 * 86400e3;
  const at = nextRunAt(Date.parse('2026-10-07T12:00Z'), week);
  assert.equal(new Date(at - CLOSE_DELAY_MS).toISOString(), '2026-10-12T00:00:00.000Z');
  assert.equal(new Date(at).getUTCDay(), 1);
});

test('symbols with a tick below 0.01 are refused (the engine cannot print their prices)', async () => {
  const run = scanner({ mintick: 0.0001 });
  await assert.rejects(run.s.start(), /0\.0001/);
});

test('prices are rounded to the symbol tick (BCH 0.1: 310.44 → 310.4)', () => {
  const a = roundToTick({ upper: 310.44, lower: 303.44, close: 303.8, upper_now: 310.06 }, 0.1);
  assert.deepEqual([a.upper, a.lower, a.close, a.upper_now, a.lower_now], [310.4, 303.4, 303.8, 310.1, undefined]);
});
