#!/usr/bin/env node
// Real-chart replay: runs seam/pine/SEAM_Patterns.pine on exchange candles with the offline engine (piner)
// and prints the formal events the way the indicator's 확정 로그 shows them.
//
// Two uses:
//   1. Candidate cases for seam/tests/cases.md §3 — then confirm each one on TradingView.
//   2. Parity (--expect): compare with a transcribed TradingView log. The scanner design
//      (seam/docs/SCANNER.md) relies on the offline run matching TradingView on the same candles.
//
// Candles: Binance spot public market data (no key, seam/scanner/src/binance.mjs). This is not TradingView.
//
//   node replay.mjs --symbol BINANCE:BTCUSDT --tf 1 --from 2026-09-28T12:00+09:00 --to 2026-09-28T14:00+09:00
//   node replay.mjs --klines ../real/btcusdt-1m-2026-09-28.klines.json --expect ../real/btcusdt-1m-2026-09-28.tv.json
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Engine, ArrayFeed } from '@heyphat/piner';
import { getCompiled } from './harness.mjs';
import { fetchCandles, TF } from '../../scanner/src/binance.mjs';
import { ENGINE_PRICE_STEP, tickWarning } from '../../scanner/src/tv-compat.mjs';

export { ENGINE_PRICE_STEP, fetchCandles, tickWarning };

const CODE = { lock: 'LOCK', break_up: 'UP', break_down: 'DOWN', retest: 'RETEST', fail: 'FAIL', expire: 'EXPIRE' };

export async function runReplay(candles, inputs = {}) {
  const bars = candles.bars.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }));
  const eng = new Engine(getCompiled(), new ArrayFeed(bars), {
    // retest / expire on so the alert stream equals the 확정 로그 (the log ignores alert toggles)
    inputs: { retest: true, expire: true, ...inputs },
  });
  await eng.run({ symbol: candles.symbol, timeframe: candles.tf, mintick: candles.mintick });
  return eng.outputs.alerts.map((a) => toEvent(JSON.parse(a.message)));
}

// Same fields the Pine log prints (f_log): LOCK 상/하 = locked values, UP 상 / DOWN 하 = line at the event bar, else 종가.
function toEvent(j) {
  const px = j.event === 'lock' ? [j.upper, j.lower] : j.event === 'break_up' ? [j.upper_now] : j.event === 'break_down' ? [j.lower_now] : [j.close];
  return { code: CODE[j.event], key: j.key, barMs: j.bar_ts * 1000, lockMs: j.lock_ts * 1000, px, grade: j.grade };
}

export function formatTime(ms, tz, tf) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  );
  return /^\d+$/.test(tf) ? `${p.month}-${p.day} ${p.hour}:${p.minute}` : `${p.year}-${p.month}-${p.day}`;
}

function pxText(e, digits) {
  const f = (v) => (v == null ? '-' : v.toFixed(digits));
  if (e.code === 'LOCK') return `상 ${f(e.px[0])} 하 ${f(e.px[1])}`;
  if (e.code === 'UP') return `상 ${f(e.px[0])}`;
  if (e.code === 'DOWN') return `하 ${f(e.px[0])}`;
  return `종가 ${f(e.px[0])}`;
}

export function digitsOf(mintick) {
  return Math.max(0, Math.round(-Math.log10(mintick)));
}

// expected: { events: [{ code, at, key, px: [...] }], until? } — a transcribed TradingView log.
// Every expected event must appear at the same bar with the same key and prices within one tick.
// Engine events after the log's oldest row, up to `until`, that the log does not have are reported as extra.
// "After" is in emission order: the log shows only its last rows, so an event emitted just before the oldest
// row on the same bar was cut off the screen, not missed by TradingView.
export function compare(events, expected, mintick) {
  const tol = mintick * 0.5 + 1e-9;
  const want = expected.events.map((w) => ({ ...w, barMs: Date.parse(w.at) }));
  const used = new Set();
  const at = [];
  const rows = want.map((w) => {
    const i = events.findIndex((e, k) => !used.has(k) && e.code === w.code && e.key === w.key && e.barMs === w.barMs);
    at.push(i);
    if (i < 0) return { want: w, status: 'missing' };
    used.add(i);
    const got = events[i];
    const same = w.px.length === got.px.length && w.px.every((v, k) => Math.abs(v - got.px[k]) <= tol);
    return { want: w, got, status: same ? 'match' : 'price' };
  });
  const lo = Math.min(...want.map((w) => w.barMs));
  const hi = expected.until ? Date.parse(expected.until) : Math.max(...want.map((w) => w.barMs));
  const oldest = Math.min(...at.filter((i, n) => i >= 0 && want[n].barMs === lo));
  const after = (e, k) => (Number.isFinite(oldest) ? k > oldest : e.barMs >= lo);
  const extra = events.filter((e, k) => !used.has(k) && after(e, k) && e.barMs <= hi);
  return { rows, extra, ok: rows.every((r) => r.status === 'match') && extra.length === 0 };
}

async function main() {
  const { values: o } = parseArgs({
    options: {
      symbol: { type: 'string' }, tf: { type: 'string', default: '60' },
      from: { type: 'string' }, to: { type: 'string' }, warmup: { type: 'string', default: '3000' },
      sens: { type: 'string', default: 'normal' }, draw: { type: 'string', default: '1' },
      klines: { type: 'string' }, save: { type: 'string' }, expect: { type: 'string' },
      tz: { type: 'string', default: 'Asia/Seoul' },
    },
  });
  const expected = o.expect ? JSON.parse(fs.readFileSync(o.expect, 'utf8')) : null;
  let candles;
  if (o.klines) {
    candles = JSON.parse(fs.readFileSync(o.klines, 'utf8'));
  } else {
    const symbol = o.symbol ?? expected?.symbol;
    const tf = expected?.tf ?? o.tf;
    if (!symbol) throw new Error('--symbol (or --expect / --klines) is required');
    const stepMs = TF[tf]?.[1];
    const fromMs = Date.parse(o.from ?? expected?.events.map((e) => e.at).sort()[0]);
    const toMs = o.to ? Date.parse(o.to) : expected?.until ? Date.parse(expected.until) : Date.now();
    if (!stepMs || Number.isNaN(fromMs) || Number.isNaN(toMs)) throw new Error('need --tf, --from (ISO time with offset) and optionally --to');
    candles = await fetchCandles({ symbol, tf, startMs: fromMs - Number(o.warmup) * stepMs, endMs: toMs });
    if (o.save) fs.writeFileSync(o.save, JSON.stringify(candles) + '\n');
  }
  const inputs = { 민감도: o.sens, '표시 개수': Number(o.draw), ...(expected?.inputs ?? {}) };
  const t0 = performance.now();
  const events = await runReplay(candles, inputs);
  const ms = Math.round(performance.now() - t0);
  const digits = digitsOf(candles.mintick);
  const tz = expected?.tz ?? o.tz;
  // print range: --from/--to, else the span of the expected log, else everything
  const span = expected ? expected.events.map((e) => Date.parse(e.at)) : [];
  const fromMs = o.from ? Date.parse(o.from) : span.length ? Math.min(...span) : -Infinity;
  const toMs = o.to ? Date.parse(o.to) : expected?.until ? Date.parse(expected.until) : Infinity;
  const bars = candles.bars;

  console.log(`${candles.symbol} · ${candles.tf} · ${bars.length} closed bars ${formatTime(bars[0][0], tz, candles.tf)} ~ ${formatTime(bars.at(-1)[0], tz, candles.tf)} (${tz}) · ${ms} ms`);
  if (tickWarning(candles.mintick)) console.log(`주의: ${tickWarning(candles.mintick)}`);
  console.log(`inputs: ${JSON.stringify(inputs)}\n`);
  const line = (e) => `${e.code.padEnd(7)} ${formatTime(e.barMs, tz, candles.tf)}  ${e.key.padEnd(14)} ${pxText(e, digits)}`;
  for (const e of events) if (e.barMs >= fromMs && e.barMs <= toMs) console.log(line(e));

  if (expected) {
    const r = compare(events, expected, candles.mintick);
    console.log(`\n대조: ${expected.source ?? o.expect}`);
    for (const row of r.rows) {
      const mark = row.status === 'match' ? 'ok     ' : row.status === 'price' ? 'PRICE  ' : 'MISSING';
      const got = row.got ? `  → 엔진 ${pxText(row.got, digits)}` : '';
      console.log(`${mark} ${line(row.want)}${row.status === 'match' ? '' : got}`);
    }
    for (const e of r.extra) console.log(`EXTRA   ${line(e)}`);
    console.log(r.ok ? '\n결과: TradingView 로그와 일치' : `\n결과: 불일치 ${r.rows.filter((x) => x.status !== 'match').length} · 추가 ${r.extra.length}`);
    process.exitCode = r.ok ? 0 : 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(2);
  });
}
