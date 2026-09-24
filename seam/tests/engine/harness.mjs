// Offline harness: compiles seam/pine/SEAM_Patterns.pine with piner (a clean-room Pine v6 engine,
// dev-only dependency, not shipped) and runs it on synthetic OHLC built from waypoints.
// This is not TradingView. It checks our logic and invariants; the final compile check is still
// "Add to chart" on TradingView.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile, Engine, ArrayFeed } from '@heyphat/piner';

export const PINE_PATH = fileURLToPath(new URL('../../pine/SEAM_Patterns.pine', import.meta.url));

let compiled;
export function getCompiled() {
  compiled ??= compile(fs.readFileSync(PINE_PATH, 'utf8'));
  return compiled;
}

// Deterministic PRNG (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// waypoints [[bar, price], ...] → close path by linear interpolation, OHLC with small noise.
export function makeBars(waypoints, { seed = 1, noise = 0.25, wick = 0.35, t0 = Date.UTC(2026, 0, 5), stepMs = 3600e3 } = {}) {
  const r = rng(seed);
  const n = waypoints[waypoints.length - 1][0] + 1;
  const path = new Array(n);
  for (let w = 0; w < waypoints.length - 1; w++) {
    const [x0, y0] = waypoints[w];
    const [x1, y1] = waypoints[w + 1];
    for (let x = x0; x <= x1; x++) path[x] = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  const bars = [];
  let prev = path[0];
  for (let i = 0; i < n; i++) {
    const c = path[i] + (r() - 0.5) * noise;
    const o = prev;
    bars.push({
      time: t0 + i * stepMs,
      open: +o.toFixed(4),
      high: +(Math.max(o, c) + r() * wick).toFixed(4),
      low: +(Math.min(o, c) - r() * wick).toFixed(4),
      close: +c.toFixed(4),
      volume: 1000,
    });
    prev = c;
  }
  return bars;
}

export function randomWalk(n, seed) {
  const r = rng(seed);
  const wp = [[0, 100]];
  let p = 100;
  let x = 0;
  while (x < n) {
    x += 3 + Math.floor(r() * 12);
    p = Math.max(20, p + (r() - 0.5) * 14);
    wp.push([Math.min(x, n), p]);
  }
  return makeBars(wp, { seed: seed + 1, noise: 0.6, wick: 0.5 });
}

export const RUN = { symbol: 'NASDAQ:TEST', timeframe: '60', mintick: 0.01 };

export async function run(bars, inputs = {}) {
  const eng = new Engine(getCompiled(), new ArrayFeed(bars), { inputs });
  await eng.run(RUN);
  return { eng, raw: eng.outputs.alerts, alerts: eng.outputs.alerts.map((a) => ({ bar: a.bar, ...JSON.parse(a.message) })) };
}
