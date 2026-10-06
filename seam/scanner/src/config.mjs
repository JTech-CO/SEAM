// watchlist.json (committed: series + indicator inputs) and env (secrets, never committed) → validated config.
// No numeric tuning here (PRINCIPLE 7): indicator numbers live in the Pine presets.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_EVENTS } from '../../relay/src/config.ts';
import { EVENTS } from '../../relay/src/schema.ts';
import { pairOf, TF } from './binance.mjs';

export const WATCHLIST_PATH = fileURLToPath(new URL('../watchlist.json', import.meta.url));
export const STATE_PATH = fileURLToPath(new URL('../scanner-state.json', import.meta.url));

// watchlist: { series: [{ symbol, tf }], inputs: { <Pine input title>: value } }
export function parseWatchlist(raw, knownInputs) {
  const errors = [];
  const w = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const series = [];
  for (const [i, s] of (Array.isArray(w?.series) ? w.series : []).entries()) {
    try {
      const symbol = `BINANCE:${pairOf(String(s?.symbol ?? ''))}`;
      const tf = String(s?.tf ?? '');
      if (!TF[tf]) throw new Error(`series[${i}].tf ${tf || '(none)'} — use ${Object.keys(TF).join(' ')}`);
      const id = `${symbol}|${tf}`;
      if (series.some((x) => x.id === id)) throw new Error(`series[${i}] ${id} listed twice`);
      series.push({ id, symbol, tf });
    } catch (e) {
      errors.push(e.message);
    }
  }
  if (!series.length && !errors.length) errors.push('watchlist has no series');
  const inputs = { ...(w?.inputs ?? {}) };
  for (const k of Object.keys(inputs)) if (knownInputs && !knownInputs.has(k)) errors.push(`unknown indicator input "${k}" (use the input title shown in TradingView settings)`);
  if (errors.length) throw new Error(`watchlist invalid:\n - ${errors.join('\n - ')}`);
  return { series, inputs };
}

export function loadWatchlist(knownInputs, path = WATCHLIST_PATH) {
  return parseWatchlist(fs.readFileSync(path, 'utf8'), knownInputs);
}

export function loadEnv(env = process.env) {
  const errors = [];
  const str = (k) => env[k]?.trim() || undefined;
  const dryRaw = str('SEAM_DRY_RUN')?.toLowerCase();
  const dryRun = ['1', 'true', 'yes', 'on'].includes(dryRaw ?? '');
  if (dryRaw && !dryRun && !['0', 'false', 'no', 'off'].includes(dryRaw)) errors.push('SEAM_DRY_RUN must be true/false');
  const botToken = str('TELEGRAM_BOT_TOKEN') ?? '';
  const chatId = str('TELEGRAM_CHAT_ID') ?? '';
  if (!dryRun && !/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(botToken)) errors.push('TELEGRAM_BOT_TOKEN missing or malformed');
  if (!dryRun && !/^(-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/.test(chatId)) errors.push('TELEGRAM_CHAT_ID missing or malformed (npm run chat-id finds it)');
  let events = new Set(DEFAULT_EVENTS);
  const ev = str('SEAM_EVENTS');
  if (ev) {
    const list = ev.split(',').map((s) => s.trim()).filter(Boolean);
    const bad = list.filter((e) => !EVENTS.includes(e));
    if (bad.length) errors.push(`SEAM_EVENTS has unknown events: ${bad.join(',')}`);
    events = new Set(list.filter((e) => EVENTS.includes(e)));
  }
  if (errors.length) throw new Error(`env invalid:\n - ${errors.join('\n - ')}`);
  return {
    dryRun,
    botToken,
    chatId: chatId || 'dry-run',
    apiBase: (str('TELEGRAM_API_BASE') ?? 'https://api.telegram.org').replace(/\/+$/, ''),
    events,
    statePath: str('SEAM_STATE_FILE') ?? STATE_PATH,
  };
}
