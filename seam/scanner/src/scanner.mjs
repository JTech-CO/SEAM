// Watchlist scanner core (seam/docs/SCANNER.md 3.4–3.6).
// Per series it keeps a window of closed bars. At each bar close it reruns the indicator over the whole window
// and sends only the events of bars that closed since the last run, through the relay's own filters and text.
// Rerunning the window is safe because a run on fewer bars equals the start of a run on more (replay prefix,
// seam/tests/engine), so earlier bars never get new events.
import fs from 'node:fs';
import { buildMessage } from '../../relay/src/format.ts';
import { destinationsFor, mergePrefixes } from '../../relay/src/route.ts';
import { idempotencyKey, structureId, validateAlert } from '../../relay/src/schema.ts';
import { closedBars, stepOf, tickSize } from './binance.mjs';
import { runWindow } from './engine.mjs';
import { tickWarning } from './tv-compat.mjs';

export const WARMUP_BARS = 3000;      // bars run before the first send; their events are history, not alerts
export const MAX_BARS = 6000;         // window cap; past it the start moves up and the window shrinks to WARMUP_BARS
export const CATCHUP_BARS = 3;        // after a restart or an outage, events of at most this many missed bars are sent
export const CLOSE_DELAY_MS = 3000;   // run this long after the bar close, so the exchange already serves the bar
export const RETRY_MS = 5000;         // closed bar not served yet, or a request failed: try again after this
export const RETRIES = 12;            // …this many times, then wait for the next bar close (it fetches the gap too)
const SENT_TTL_MS = 7 * 86400e3;      // how long a sent event key is kept in the state file
// Storm guard per series and bar. The relay limits per minute of wall time; here a catch-up sends several
// bars at once, so the limit counts per bar instead (one bar rarely has more than two or three events).
const MAX_PER_BAR = 6;

// Bars open on multiples of their length from the Unix epoch, except weekly bars: Binance opens them on Monday
// 00:00 UTC, and the epoch (1970-01-01) was a Thursday.
const WEEK = 7 * 86400e3;
const WEEK_OFFSET = 4 * 86400e3;

export function nextRunAt(now, step) {
  const off = step === WEEK ? WEEK_OFFSET : 0;
  return Math.floor((now - off) / step) * step + off + step + CLOSE_DELAY_MS;
}

// piner prints prices in 0.01 steps (tv-compat.mjs). Round back to the symbol's tick: a no-op at 0.01,
// and at 0.1 (BCH) the message shows what TradingView shows (310.4, not 310.44).
export function roundToTick(a, tick) {
  const d = Math.max(0, Math.round(-Math.log10(tick)));
  const r = (v) => (typeof v === 'number' ? Number((Math.round(v / tick) * tick).toFixed(d)) : v);
  const out = { ...a, upper: r(a.upper), lower: r(a.lower), close: r(a.close) };
  if (a.upper_now !== undefined) out.upper_now = r(a.upper_now);
  if (a.lower_now !== undefined) out.lower_now = r(a.lower_now);
  return out;
}

// { series: { [id]: { lastBar } }, sent: { [idempotencyKey]: expiresAt } }
export function loadState(path) {
  if (!path) return { series: {}, sent: {} };
  try {
    const s = JSON.parse(fs.readFileSync(path, 'utf8'));
    return { series: s.series ?? {}, sent: s.sent ?? {} };
  } catch (e) {
    if (e.code === 'ENOENT') return { series: {}, sent: {} };
    throw new Error(`state file ${path} unreadable: ${e.message}`);
  }
}

function saveState(path, state, now) {
  if (!path) return;
  for (const [k, exp] of Object.entries(state.sent)) if (exp <= now) delete state.sent[k];
  fs.writeFileSync(`${path}.tmp`, `${JSON.stringify({ v: 1, ...state }, null, 1)}\n`);
  fs.renameSync(`${path}.tmp`, path); // atomic: a crash leaves the old or the new file, never half of one
}

export class Scanner {
  // market: { tickSize, closedBars } (Binance by default; tests pass recorded bars)
  // backfillBars: also send the events of this many already-closed bars at start (npm run show)
  constructor({ script, watchlist, events, chatId, sender, logger, statePath, market = { tickSize, closedBars }, now = Date.now, warmupBars = WARMUP_BARS, maxBars = MAX_BARS, catchupBars = CATCHUP_BARS, backfillBars = 0 }) {
    Object.assign(this, { script, sender, logger, statePath, market, now, warmupBars, maxBars, events });
    this.catchupBars = Math.max(catchupBars, backfillBars);
    this.backfillBars = backfillBars;
    this.series = watchlist.series;
    this.inputs = watchlist.inputs;
    this.route = { chatId, topics: {}, prefixes: mergePrefixes(undefined) };
    this.state = loadState(statePath);
    this.windows = new Map();
  }

  // Warm-up: fetch the window of each series. A fresh start sends nothing for it; a restart sends the events of
  // bars that closed while it was stopped (at most catchupBars of them).
  async start() {
    for (const s of this.series) {
      const mintick = await this.market.tickSize(s.symbol);
      const warn = tickWarning(mintick);
      if (warn) throw new Error(`${s.id}: ${warn} — remove it from watchlist.json`);
      const step = stepOf(s.tf);
      const t = this.now();
      const bars = await this.market.closedBars({ symbol: s.symbol, tf: s.tf, startMs: t - (this.warmupBars + 2) * step, endMs: t, now: t });
      if (bars.length < 2) throw new Error(`${s.id}: no closed bars from the exchange`);
      const w = { ...s, step, mintick, bars: bars.slice(-this.warmupBars) };
      const newest = w.bars.at(-1)[0];
      const prev = this.state.series[s.id]?.lastBar;
      w.lastBar = this.backfillBars ? newest - this.backfillBars * step : prev ?? newest;
      this.windows.set(s.id, w);
      this.logger.info('warmed up', { series: s.id, bars: w.bars.length, mintick, newest: new Date(newest).toISOString(), resume: prev !== undefined && !this.backfillBars });
      await this.process(w);
    }
    // written now, not at the first close: a stop just before that close still resumes from here
    for (const w of this.windows.values()) this.state.series[w.id] = { lastBar: w.lastBar };
    saveState(this.statePath, this.state, this.now());
  }

  // Fetch bars closed after the window's newest bar; if there are any, rerun and send. Returns counts.
  async poll(id) {
    const w = this.windows.get(id);
    const t = this.now();
    const from = w.bars.at(-1)[0] + w.step;
    const fresh = (await this.market.closedBars({ symbol: w.symbol, tf: w.tf, startMs: from, endMs: t, now: t })).filter((b) => b[0] >= from);
    if (!fresh.length) return { newBars: 0, sent: 0 };
    w.bars.push(...fresh);
    if (w.bars.length > this.maxBars) w.bars = w.bars.slice(-this.warmupBars);
    return { newBars: fresh.length, sent: await this.process(w) };
  }

  drop(a, t, perBar) {
    if (a.preview) return 'preview';
    if (a.grade !== 'formal') return 'reference';
    if (!this.events.has(a.event)) return 'event';
    if (this.state.sent[idempotencyKey(a)] > t) return 'duplicate';
    const n = perBar.get(a.bar_ts) ?? 0;
    if (n >= MAX_PER_BAR) return 'rate_limited';
    perBar.set(a.bar_ts, n + 1);
    return null;
  }

  async process(w) {
    const newest = w.bars.at(-1)[0];
    if (newest <= w.lastBar) return 0;
    const from = Math.max(w.lastBar, newest - this.catchupBars * w.step);
    if (from > w.lastBar) this.logger.warn('missed bars skipped', { series: w.id, bars: Math.round((from - w.lastBar) / w.step) });
    const t0 = performance.now();
    const messages = await runWindow(this.script, w, this.inputs);
    const t = this.now();
    const out = [];
    const perBar = new Map();
    for (const raw of messages) {
      const j = JSON.parse(raw);
      const barMs = (j.bar_ts ?? j.lock_ts) * 1000;
      if (!(barMs > from && barMs <= newest)) continue;
      const v = validateAlert(j);
      if (!v.ok) {
        this.logger.error('indicator payload rejected by the relay schema', { series: w.id, errors: v.errors });
        continue;
      }
      const a = roundToTick(v.alert, w.mintick);
      const reason = this.drop(a, t, perBar);
      if (reason) this.logger.info('dropped', { id: structureId(a), event: a.event, reason });
      else out.push(a);
    }
    // Record before sending (at most once, like the relay's dedupe claim): a crash mid-send loses a message
    // rather than repeating it after the restart.
    w.lastBar = newest;
    this.state.series[w.id] = { lastBar: newest };
    for (const a of out) this.state.sent[idempotencyKey(a)] = t + SENT_TTL_MS;
    saveState(this.statePath, this.state, t);
    this.logger.info('bar closed', { series: w.id, bar: new Date(newest).toISOString(), bars: w.bars.length, events: out.length, ms: Math.round(performance.now() - t0) });
    for (const a of out) {
      const text = buildMessage(a);
      for (const d of destinationsFor(a, this.route)) {
        const r = await this.sender(d, text);
        const fields = { id: structureId(a), event: a.event, status: r.status };
        if (r.ok) this.logger.info('sent', fields);
        else this.logger.error('send failed', { ...fields, description: r.description });
      }
    }
    return out.length;
  }

  // Forever: each series runs CLOSE_DELAY_MS after its bar closes. A bar the exchange does not serve yet, or a
  // failed request, is retried every RETRY_MS up to RETRIES times; the next close fetches whatever is missing.
  async run({ sleep = (ms) => new Promise((r) => setTimeout(r, ms)), stop = () => false } = {}) {
    const due = new Map([...this.windows.values()].map((w) => [w.id, nextRunAt(this.now(), w.step)]));
    const tries = new Map();
    while (!stop()) {
      const [id, at] = [...due].reduce((a, b) => (b[1] < a[1] ? b : a));
      await sleep(Math.max(0, at - this.now()));
      if (stop()) break;
      const w = this.windows.get(id);
      let retry = false;
      try {
        retry = (await this.poll(id)).newBars === 0;
      } catch (e) {
        this.logger.warn('poll failed', { series: id, error: e.message });
        retry = true;
      }
      const n = tries.get(id) ?? 0;
      if (retry && n < RETRIES) {
        tries.set(id, n + 1);
        due.set(id, this.now() + RETRY_MS);
      } else {
        if (retry) this.logger.warn('no new bar after retries', { series: id });
        tries.set(id, 0);
        due.set(id, nextRunAt(this.now(), w.step));
      }
    }
  }
}
