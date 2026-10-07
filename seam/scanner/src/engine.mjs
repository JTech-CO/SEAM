// Runs seam/pine/SEAM_Patterns.pine — the same file TradingView runs — with the offline engine (piner) and
// returns the alert() payloads. One rule source: changing the indicator changes the scanner (SCANNER.md 3.1).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ArrayFeed, compile, Engine } from '@heyphat/piner';
import { applyTradingViewRules } from './tv-compat.mjs';

export const PINE_PATH = fileURLToPath(new URL('../../pine/SEAM_Patterns.pine', import.meta.url));

applyTradingViewRules({ compile, Engine, ArrayFeed });

export function loadScript(path = PINE_PATH) {
  const source = fs.readFileSync(path, 'utf8');
  const compiled = compile(source);
  if (compiled.diagnostics?.length) throw new Error(`${path}: ${compiled.diagnostics.map((d) => d.message ?? String(d)).join('; ')}`);
  return {
    compiled,
    // panel header on TradingView shows the same string ("SEAM 26.10.05")
    rev: source.match(/const string REV = "([^"]+)"/)?.[1] ?? '?',
    // input titles, so a typo in watchlist.json fails at start instead of being ignored by the engine
    inputs: new Set([...source.matchAll(/input\.\w+\([^,]+,\s*"([^"]+)"/g)].map((m) => m[1])),
  };
}

// candles: { symbol: 'BINANCE:BTCUSDT', tf: '60', mintick, bars: [[openMs, o, h, l, c, v], ...] }, closed bars only.
// Returns the alert() messages (JSON strings) of the whole window, oldest first.
export async function runWindow(script, candles, inputs = {}) {
  const bars = candles.bars.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }));
  const eng = new Engine(script.compiled, new ArrayFeed(bars), { inputs });
  await eng.run({ symbol: candles.symbol, timeframe: candles.tf, mintick: candles.mintick });
  return eng.outputs.alerts.map((a) => a.message);
}
