#!/usr/bin/env node
// Real-chart replay: runs seam/pine/SEAM_Patterns.pine on exchange candles with the offline engine (piner)
// and prints the formal events the way the indicator's 확정 로그 shows them.
//
// Two uses:
//   1. Candidate cases for seam/tests/cases.md §3 — then confirm each one on TradingView.
//   2. Parity (--expect): compare with a transcribed TradingView log. The scanner design
//      (seam/docs/SCANNER.md) relies on the offline run matching TradingView on the same candles.
//
// Candles: Binance spot public market data (no key). This is not TradingView.
//
//   node replay.mjs --symbol BINANCE:BTCUSDT --tf 1 --from 2026-09-28T12:00+09:00 --to 2026-09-28T14:00+09:00
//   node replay.mjs --klines ../real/btcusdt-1m-2026-09-28.klines.json --expect ../real/btcusdt-1m-2026-09-28.tv.json
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Engine, ArrayFeed } from '@heyphat/piner';
import { getCompiled } from './harness.mjs';

// TradingView timeframe → Binance interval and bar length
const TF = {
  1: ['1m', 60e3], 3: ['3m', 180e3], 5: ['5m', 300e3], 15: ['15m', 900e3], 30: ['30m', 1800e3],
  60: ['1h', 3600e3], 120: ['2h', 7200e3], 240: ['4h', 14400e3], D: ['1d', 86400e3], W: ['1w', 604800e3],
};
// Market-data-only host first: api.binance.com answers 451 from some regions (US cloud runners).
const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];
// piner reads syminfo.mintick correctly but math.round_to_mintick / format.mintick always round to 0.01.
// Detection does not use them (only the JSON / tooltip / log text does), so below 0.01 the structures are
// the same as TradingView but the printed prices are rounded. seam/docs/SCANNER.md 3.1 has the fix plan.
export const ENGINE_PRICE_STEP = 0.01;
export function tickWarning(mintick) {
  return mintick < ENGINE_PRICE_STEP - 1e-12
    ? `호가 단위 ${mintick} < ${ENGINE_PRICE_STEP}: 오프라인 엔진이 출력 가격을 ${ENGINE_PRICE_STEP} 단위로 반올림합니다 (구조 판정은 같음, 가격 비교는 불가)`
    : '';
}
const CODE = { lock: 'LOCK', break_up: 'UP', break_down: 'DOWN', retest: 'RETEST', fail: 'FAIL', expire: 'EXPIRE' };

async function getJson(path) {
  const errors = [];
  for (const host of HOSTS) {
    try {
      const res = await fetch(host + path, { signal: AbortSignal.timeout(15000) });
      if (res.ok) return await res.json();
      errors.push(`${host} ${res.status} ${(await res.text()).replace(/\s+/g, ' ').slice(0, 90)}`);
    } catch (e) {
      errors.push(`${host} ${e.cause?.code ?? e.message}`);
    }
  }
  throw new Error(`Binance request failed: ${errors.join(', ')}`);
}

function splitSymbol(symbol) {
  const [prefix, pair] = symbol.includes(':') ? symbol.split(':') : ['BINANCE', symbol];
  if (prefix !== 'BINANCE') throw new Error(`only BINANCE:* is supported for now (got ${symbol})`);
  return pair;
}

// Closed candles only: a candle whose close time has not passed is still forming (confirm-on-close).
export async function fetchCandles({ symbol, tf, startMs, endMs, now = Date.now() }) {
  const pair = splitSymbol(symbol);
  const [interval, stepMs] = TF[tf] ?? [];
  if (!interval) throw new Error(`unsupported tf ${tf} (use ${Object.keys(TF).join(' ')})`);
  const info = await getJson(`/api/v3/exchangeInfo?symbol=${pair}`);
  const tick = info.symbols?.[0]?.filters?.find((f) => f.filterType === 'PRICE_FILTER')?.tickSize;
  const rows = [];
  for (let t = startMs; t <= endMs; ) {
    const page = await getJson(`/api/v3/klines?symbol=${pair}&interval=${interval}&startTime=${t}&endTime=${endMs}&limit=1000`);
    if (!page.length) break;
    for (const k of page) if (k[6] < now) rows.push([k[0], +k[1], +k[2], +k[3], +k[4], +k[5]]);
    t = page[page.length - 1][0] + stepMs;
    if (page.length < 1000) break;
  }
  return { v: 1, source: 'binance-spot', symbol: `BINANCE:${pair}`, tf: String(tf), mintick: tick ? +tick : 0.01, bars: rows };
}

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
