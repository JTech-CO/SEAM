// Binance spot public market data (no key). Closed candles only: a candle whose close time has not passed is
// still forming, and the indicator only decides on closed bars (PRINCIPLE 1).
// Shared by the scanner and the engine test tools (replay.mjs, candidates.mjs).

// TradingView timeframe → Binance interval and bar length
export const TF = {
  1: ['1m', 60e3], 3: ['3m', 180e3], 5: ['5m', 300e3], 15: ['15m', 900e3], 30: ['30m', 1800e3],
  60: ['1h', 3600e3], 120: ['2h', 7200e3], 240: ['4h', 14400e3], D: ['1d', 86400e3], W: ['1w', 604800e3],
};
// Market-data-only host first: api.binance.com answers 451 from some regions (US cloud runners).
export const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

export function stepOf(tf) {
  const s = TF[tf]?.[1];
  if (!s) throw new Error(`unsupported tf ${tf} (use ${Object.keys(TF).join(' ')})`);
  return s;
}

async function getJson(path, fetchImpl) {
  const errors = [];
  for (const host of HOSTS) {
    try {
      const res = await fetchImpl(host + path, { signal: AbortSignal.timeout(15000) });
      if (res.ok) return await res.json();
      errors.push(`${host} ${res.status} ${(await res.text()).replace(/\s+/g, ' ').slice(0, 90)}`);
    } catch (e) {
      errors.push(`${host} ${e.cause?.code ?? e.message}`);
    }
  }
  throw new Error(`Binance request failed: ${errors.join(', ')}`);
}

export function pairOf(symbol) {
  const [prefix, pair] = symbol.includes(':') ? symbol.split(':') : ['BINANCE', symbol];
  if (prefix !== 'BINANCE' || !/^[A-Z0-9]{2,20}$/.test(pair ?? '')) throw new Error(`only BINANCE:<PAIR> is supported for now (got ${symbol})`);
  return pair;
}

export async function tickSize(symbol, { fetchImpl = fetch } = {}) {
  const info = await getJson(`/api/v3/exchangeInfo?symbol=${pairOf(symbol)}`, fetchImpl);
  const tick = info.symbols?.[0]?.filters?.find((f) => f.filterType === 'PRICE_FILTER')?.tickSize;
  return tick ? +tick : 0.01;
}

// [openTime, open, high, low, close, volume] rows of closed bars with open time in [startMs, endMs]
export async function closedBars({ symbol, tf, startMs, endMs, now = Date.now(), fetchImpl = fetch }) {
  const pair = pairOf(symbol);
  const [interval, step] = [TF[tf]?.[0], stepOf(tf)];
  const rows = [];
  for (let t = startMs; t <= endMs; ) {
    const page = await getJson(`/api/v3/klines?symbol=${pair}&interval=${interval}&startTime=${t}&endTime=${endMs}&limit=1000`, fetchImpl);
    if (!page.length) break;
    for (const k of page) if (k[6] < now) rows.push([k[0], +k[1], +k[2], +k[3], +k[4], +k[5]]);
    t = page[page.length - 1][0] + step;
    if (page.length < 1000) break;
  }
  return rows;
}

// The candle file format of seam/tests/real/*.klines.json
export async function fetchCandles({ symbol, tf, startMs, endMs, now = Date.now(), fetchImpl = fetch }) {
  const mintick = await tickSize(symbol, { fetchImpl });
  const bars = await closedBars({ symbol, tf, startMs, endMs, now, fetchImpl });
  return { v: 1, source: 'binance-spot', symbol: `BINANCE:${pairOf(symbol)}`, tf: String(tf), mintick, bars };
}
